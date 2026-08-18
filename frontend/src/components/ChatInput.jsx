import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, Database, Settings2, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ModelBadge({ model }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Sparkles size={13} className="text-slate-500" />
      <span className="capitalize">{model?.provider || 'ollama'}</span>
      {model?.model && <span className="text-slate-400">·</span>}
      {model?.model && <span className="font-normal">{model.model}</span>}
    </span>
  );
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  onStop,
  model,
  onModelChange,
  kbIds,
  onKbChange,
  kbs,
  modelGroups,
}) {
  const textareaRef = useRef(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const modelMenuRef = useRef(null);
  const kbMenuRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    const onClick = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelOpen(false);
      if (kbMenuRef.current && !kbMenuRef.current.contains(e.target)) setKbOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const toggleKb = (id) => {
    const next = kbIds.includes(id) ? kbIds.filter((k) => k !== id) : [...kbIds, id];
    onKbChange(next);
  };

  const hasSelection = kbIds.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition focus-within:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none dark:focus-within:border-slate-600">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask anything about your knowledge bases…"
          className="max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 text-[0.925rem] leading-relaxed placeholder-slate-400 focus:outline-none dark:placeholder-slate-500"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setModelOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Switch model"
              >
                <ModelBadge model={model} />
                <ChevronDown size={13} className="opacity-60" />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {modelGroups.map((group) => (
                    <div key={group.provider}>
                      <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {group.label}
                      </p>
                      {group.models.map((m) => (
                        <button
                          key={m.model || 'default'}
                          onClick={() => {
                            onModelChange({ provider: group.provider, model: m.model });
                            setModelOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            model?.provider === group.provider && model?.model === m.model
                              ? 'text-slate-600 dark:text-slate-200'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate">{m.model || 'Default'}</span>
                          {model?.provider === group.provider && model?.model === m.model && (
                            <Check size={13} />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                  <Link
                    to="/settings"
                    onClick={() => setModelOpen(false)}
                    className="mt-1 flex items-center gap-1.5 rounded-lg border-t border-slate-100 px-2.5 py-2 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Settings2 size={13} />
                    Manage models &amp; providers
                  </Link>
                </div>
              )}
            </div>

            <div className="relative" ref={kbMenuRef}>
              <button
                onClick={() => setKbOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Select knowledge bases"
              >
                <Database size={13} className="opacity-70" />
                {hasSelection ? `${kbIds.length} KB selected` : 'All documents'}
                <ChevronDown size={13} className="opacity-60" />
              </button>
              {kbOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Knowledge bases
                  </p>
                  {kbs.length === 0 && (
                    <p className="px-2.5 py-2 text-xs text-slate-400">
                      No knowledge bases yet.{' '}
                      <Link to="/knowledge-bases" className="text-slate-500 hover:underline">
                        Create one
                      </Link>
                    </p>
                  )}
                  {kbs.map((kb) => (
                    <button
                      key={kb.id}
                      onClick={() => toggleKb(kb.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{kb.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {kb.document_count} documents
                        </span>
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          kbIds.includes(kb.id)
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {kbIds.includes(kb.id) && <Check size={10} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sending ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
              title="Stop generating"
            >
              <X size={15} />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!value.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow transition hover:opacity-90 disabled:opacity-30"
              title="Send"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
        AI can make mistakes. Answers cite sources from your selected knowledge bases.
      </p>
    </div>
  );
}