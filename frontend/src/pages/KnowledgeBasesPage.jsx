import { useCallback, useEffect, useState } from 'react';
import { Database, Pencil, Plus, Trash2 } from 'lucide-react';
import { knowledgeBasesApi } from '../api/endpoints';

export default function KnowledgeBasesPage() {
  const [kbs, setKbs] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setKbs(await knowledgeBasesApi.list());
    } catch {
      /* interceptor handles auth */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await knowledgeBasesApi.create({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      setSuccess(`Knowledge base "${name.trim()}" created`);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create knowledge base');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (kb) => {
    const next = window.prompt('Rename knowledge base', kb.name);
    if (!next || next.trim() === kb.name) return;
    setError('');
    setSuccess('');
    try {
      await knowledgeBasesApi.update(kb.id, { name: next.trim() });
      setSuccess('Knowledge base renamed');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to rename knowledge base');
    }
  };

  const handleDelete = async (kb) => {
    if (!window.confirm(`Delete "${kb.name}" and all its documents?`)) return;
    setError('');
    setSuccess('');
    try {
      await knowledgeBasesApi.remove(kb.id);
      setSuccess(`"${kb.name}" deletion queued`);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete knowledge base');
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Knowledge Bases</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Group your documents. In chat, select one or more knowledge bases to search.
      </p>

      <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          <Plus size={14} /> New knowledge base
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Name, e.g. Engineering Docs"
          className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Description (optional)"
          className="mb-3 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </form>

      <div className="space-y-3">
        {kbs.map((kb) => (
          <div
            key={kb.id}
            className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Database size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{kb.name}</p>
                {kb.description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{kb.description}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  {kb.document_count} documents · created {new Date(kb.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => handleRename(kb)} className="icon-btn !p-2" title="Rename">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(kb)}
                className="icon-btn !p-2 text-slate-400 hover:text-red-500"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {kbs.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
            No knowledge bases yet. Uploads without a base go to an auto-created "Default".
          </p>
        )}
      </div>
    </div>
  );
}