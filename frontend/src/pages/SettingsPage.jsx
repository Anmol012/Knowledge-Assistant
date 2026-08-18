import { useEffect, useState } from 'react';
import { Check, ChevronDown, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { PROVIDERS, providersApi } from '../api/endpoints';

const EMPTY_FORM = { provider: 'openai', api_key: '', model: '', base_url: '' };

export default function SettingsPage() {
  const [configs, setConfigs] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaError, setOllamaError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [suggestedModels, setSuggestedModels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    try {
      setConfigs(await providersApi.list());
    } catch {
      /* interceptor handles auth */
    }
  };

  const loadOllamaModels = async () => {
    setOllamaError('');
    try {
      const result = await providersApi.models('ollama');
      setOllamaModels(result.models || []);
      return result;
    } catch (err) {
      setOllamaError(err.response?.data?.detail || 'Could not reach Ollama');
      setOllamaModels([]);
      return null;
    }
  };

  useEffect(() => {
    refresh();
    loadOllamaModels();
  }, []);

  useEffect(() => {
    if (form.provider === 'ollama') return;
    providersApi
      .models(form.provider)
      .then((r) => setSuggestedModels(r.models || []))
      .catch(() => setSuggestedModels([]));
  }, [form.provider]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = { provider: form.provider, model: form.model.trim() || undefined };
      if (form.provider === 'ollama') {
        payload.base_url = form.base_url.trim();
        payload.api_key = undefined;
      } else {
        payload.api_key = form.api_key;
        if (form.base_url.trim()) payload.base_url = form.base_url.trim();
      }
      await providersApi.upsert(payload);
      setForm(EMPTY_FORM);
      setSuccess(`${form.provider} configuration saved`);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider) => {
    if (!window.confirm(`Remove ${provider} configuration?`)) return;
    setError('');
    setSuccess('');
    try {
      await providersApi.remove(provider);
      setSuccess(`${provider} configuration removed`);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove provider');
    }
  };

  const ollamaConfig = configs.find((c) => c.provider === 'ollama');

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Settings</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Configure the LLMs used in chat. Keys are encrypted at rest.
      </p>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Ollama (local) — default
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {ollamaModels.length
                  ? `Models available: ${ollamaModels.join(', ')}`
                  : 'Local Ollama server'}{' '}
                {ollamaConfig && (
                  <span className="ml-1 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                    custom host: {ollamaConfig.base_url}
                  </span>
                )}
              </p>
              {ollamaError && (
                <p className="mt-1 text-xs text-red-500">
                  {ollamaError} — answers will fall back to the local server.
                </p>
              )}
            </div>
          </div>
          <button onClick={loadOllamaModels} className="icon-btn shrink-0" title="Refresh models">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-medium text-slate-800 dark:text-slate-200">
          Add or update a provider
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value, model: '', base_url: '', api_key: '' })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Model</label>
            <div className="relative">
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={
                  form.provider === 'ollama'
                    ? ollamaModels[0] || 'e.g. gemma:2b'
                    : 'e.g. gpt-4o-mini'
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              {suggestedModels.length > 0 && (
                <details className="absolute right-0 top-0 h-full">
                  <summary className="flex h-full cursor-pointer items-center px-2 text-slate-400 hover:text-slate-600" title="Pick from list">
                    <ChevronDown size={14} />
                  </summary>
                  <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {suggestedModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, model: m })}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {form.model === m && <Check size={12} className="text-slate-500" />}
                        <span className="truncate">{m}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
          {form.provider === 'ollama' ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                External Ollama base URL <span className="text-slate-400">(optional — leave empty for local)</span>
              </label>
              <input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="http://192.168.1.10:11434"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <p className="mt-1 text-xs text-slate-400">
                Point to your own Ollama server to use its models instead of the local one.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">API key</label>
                <input
                  type="password"
                  required
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="sk-…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
                  Base URL <span className="text-slate-400">(optional, custom gateway)</span>
                </label>
                <input
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>
            </>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Configured providers</h2>
        {configs.map((config) => (
          <div
            key={config.provider}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 capitalize dark:text-white">
                {config.provider}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                model: {config.model}
                {config.base_url && (
                  <span className="ml-1 text-slate-400">· host: {config.base_url}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {config.api_key_masked}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(config.updated_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(config.provider)}
                className="icon-btn !p-2 text-slate-400 hover:text-red-500"
                title="Remove configuration"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
            No providers configured — chats use the default local Ollama.
          </p>
        )}
      </div>
    </div>
  );
}