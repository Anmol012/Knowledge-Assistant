import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Database, Sparkles } from 'lucide-react';
import api from '../api/client';
import { chatApi, knowledgeBasesApi, providersApi } from '../api/endpoints';
import ChatMessage from '../components/ChatMessage';
import ChatInput, { ModelBadge } from '../components/ChatInput';
import { useAuth } from '../auth/AuthContext';
import { useChatList } from '../chat/ChatContext';

const SUGGESTIONS = [
  'What can this platform do?',
  'How does RAG retrieval work here?',
  'Which LLM providers are supported?',
  'What are knowledge bases?',
];

const DEFAULT_MODEL = { provider: 'ollama', model: null };

function loadSavedModel() {
  try {
    const raw = localStorage.getItem('ka-model');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.provider) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function loadSavedKbIds() {
  try {
    return JSON.parse(localStorage.getItem('ka-kb-ids') || '[]');
  } catch {
    return [];
  }
}

export default function ChatPage() {
  const { user } = useAuth();
  const { chats, activeChatId, selectChat, refreshChats } = useChatList();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState(loadSavedModel() || DEFAULT_MODEL);
  const [kbIds, setKbIds] = useState(loadSavedKbIds());
  const [kbs, setKbs] = useState([]);
  const [modelGroups, setModelGroups] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const abortRef = useRef(null);
  const justSentRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    knowledgeBasesApi
      .list()
      .then((list) => {
        setKbs(list);
        setKbIds((ids) => ids.filter((id) => list.some((kb) => kb.id === id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const ollama = await providersApi.models('ollama').catch(() => null);
        const configured = await providersApi.list().catch(() => []);
        const groups = [];
        if (ollama?.models?.length) {
          groups.push({
            provider: 'ollama',
            label: 'Ollama',
            models: ollama.models.map((m) => ({ model: m })),
          });
        } else {
          groups.push({ provider: 'ollama', label: 'Ollama', models: [{ model: null }] });
        }
        for (const p of configured) {
          if (p.provider === 'ollama') continue;
          const list = await providersApi.models(p.provider).catch(() => null);
          const models = list?.models?.length ? list.models : [p.model];
          groups.push({ provider: p.provider, label: p.provider, models: models.map((m) => ({ model: m })) });
        }
        setModelGroups(groups);
        setModelsLoaded(true);
        if (!loadSavedModel()) {
          setModel({ provider: 'ollama', model: ollama?.models?.[0] || null });
        }
      } catch {
        setModelGroups([{ provider: 'ollama', label: 'Ollama', models: [{ model: null }] }]);
        setModelsLoaded(true);
      }
    };
    load();
  }, []);

  const loadMessages = useCallback(async (chatId) => {
    try {
      const list = await chatApi.messages(chatId);
      setMessages(list);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (activeChatId) {
      if (justSentRef.current === activeChatId) {
        justSentRef.current = null;
        return;
      }
      loadMessages(activeChatId);
      const chat = chats.find((c) => c.id === activeChatId);
      if (chat) {
        if (chat.provider) setModel({ provider: chat.provider, model: chat.model || null });
        if (chat.knowledge_base_ids) setKbIds(chat.knowledge_base_ids || []);
      }
    } else {
      setMessages([]);
      setError('');
    }
  }, [activeChatId, chats, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => {
    try {
      localStorage.setItem('ka-model', JSON.stringify(model));
    } catch {
      /* ignore */
    }
  }, [model]);

  useEffect(() => {
    try {
      localStorage.setItem('ka-kb-ids', JSON.stringify(kbIds));
    } catch {
      /* ignore */
    }
  }, [kbIds]);

  const handleSend = async (fromSuggestion) => {
    const message = (fromSuggestion || input).trim();
    if (!message || sending) return;
    setInput('');
    setError('');
    setSending(true);

    const optimistic = { id: `local-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await api.post(
        '/chat',
        {
          message,
          chat_id: activeChatId || undefined,
          provider: model.provider,
          model: model.model || undefined,
          knowledge_base_ids: kbIds.length ? kbIds : undefined,
        },
        { signal: controller.signal }
      );
      const data = result.data;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { id: `local-user-${Date.now()}`, role: 'user', content: message },
        {
          id: `local-${Date.now()}-a`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources.map((s) => ({ ...s })),
        },
      ]);
      if (!activeChatId) {
        justSentRef.current = data.chat_id;
        selectChat(data.chat_id);
      } else {
        refreshChats();
      }
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED' && !err?.__CANCEL__) {
        setError(err.response?.data?.detail || 'Failed to get a response');
        if (!activeChatId) setInput(message);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleModelChange = (m) => {
    setModel({ provider: m.provider, model: m.model || null });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !sending ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 py-10">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg shadow-slate-900/10">
              <Sparkles size={30} />
            </div>
            <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Ask your knowledge
            </h1>
            <p className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
              RAG-powered answers with citations from your documents.
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="chip-btn flex items-center justify-between gap-2 text-left"
                >
                  <span>{s}</span>
                  <ArrowRight size={14} className="shrink-0 opacity-50" />
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4 text-xs text-slate-400">
              <ModelBadge model={modelsLoaded ? model : DEFAULT_MODEL} />
              <span className="flex items-center gap-1">
                <Database size={12} />
                {kbIds.length ? `${kbIds.length} KB selected` : 'All documents'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-7 px-4 py-6">
            {messages.map((m, i) => (
              <div key={m.id || i} className="animate-fade-in">
                <ChatMessage
                  message={m}
                  user={user}
                  animate={m.role === 'assistant' && i === messages.length - 1 && !sending}
                />
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                  <Sparkles size={15} />
                </div>
                <div className="flex gap-1.5 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-slate-400"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      {error && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        </div>
      )}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        sending={sending}
        onStop={handleStop}
        model={model}
        onModelChange={handleModelChange}
        kbIds={kbIds}
        onKbChange={setKbIds}
        kbs={kbs}
        modelGroups={modelGroups}
      />
    </div>
  );
}