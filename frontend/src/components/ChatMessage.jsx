import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';
import Markdown from './Markdown';
import SourcesStrip from './SourcesStrip';

const REVEAL_CHARS_PER_TICK = 2;
const REVEAL_TICK_MS = 15;

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function useReveal(content, animate) {
  const [shown, setShown] = useState(animate ? 0 : content.length);
  useEffect(() => {
    if (!animate) {
      setShown(content.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= content.length) {
          clearInterval(id);
          return n;
        }
        return n + REVEAL_CHARS_PER_TICK;
      });
    }, REVEAL_TICK_MS);
    return () => clearInterval(id);
  }, [content, animate]);

  const done = !animate || shown >= content.length;
  return { shown, done };
}

function CitationSpan({ idx, sources, onCitation }) {
  if (!sources || !sources[idx]) return <sup>[{idx + 1}]</sup>;
  return (
    <button
      className="mx-0.5 inline-block translate-y-[-2px] rounded-full bg-slate-200 px-1.5 py-0 text-[0.7em] font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
      onClick={() => onCitation(idx)}
      title={`Source ${idx + 1}: ${sources[idx].filename}`}
    >
      [{idx + 1}]
    </button>
  );
}

function splitCitations(text, sources, onCitation) {
  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = /\[(\d+)\]/g;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<CitationSpan key={match.index} idx={parseInt(match[1], 10) - 1} sources={sources} onCitation={onCitation} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function ChatMessage({ message, user, animate }) {
  const { role, content, sources } = message;
  const isUser = role === 'user';
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { shown, done } = useReveal(content, animate && !isUser);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (animate && !done) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [animate, shown, done]);

  const revealText = useMemo(() => content.slice(0, shown), [content, shown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const openCitation = (idx) => setSourcesOpen(true);

  return (
    <div className="flex gap-3.5">
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm">
          <Sparkles size={15} />
        </div>
      )}
      <div className={`min-w-0 flex-1 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div
          className={`group relative max-w-full rounded-2xl px-4 py-3 text-[0.925rem] leading-relaxed ${
            isUser
              ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-sm'
              : 'bg-transparent'
          }`}
        >
          {!isUser && (
            <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
              <button
                onClick={handleCopy}
                className="icon-btn !p-1.5"
                title={copied ? 'Copied' : 'Copy answer'}
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>
          )}
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : animate && !done ? (
            <p className="whitespace-pre-wrap">
              {splitCitations(revealText, sources, openCitation)}
              <span className="animate-caret-blink text-slate-500">▍</span>
            </p>
          ) : (
            <Markdown content={content} sources={sources} onCitation={openCitation} />
          )}
        </div>
        {!isUser && (
          <div className="px-1">
            <SourcesStrip
              sources={sources}
              expanded={sourcesOpen}
              onToggle={() => setSourcesOpen((o) => !o)}
            />
          </div>
        )}
        {isUser && (
          <div className="mt-1 flex items-center gap-2 pr-1">
            <span className="text-[10px] text-slate-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-[10px] font-semibold text-white">
              {initials(user?.full_name)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}