const statusStyles = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

export default function DocumentCard({ document, kbs, onDelete, deleting }) {
  const kb = kbs?.find((k) => k.id === document.knowledge_base_id);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {document.filename}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {document.file_type.toUpperCase()} · {document.chunk_count} chunks ·{' '}
            {new Date(document.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[document.status]}`}
        >
          {document.status}
        </span>
      </div>
      {kb && (
        <span className="mt-2 inline-block rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {kb.name}
        </span>
      )}
      {document.status === 'failed' && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {document.error}
        </p>
      )}
      {document.status === 'ready' && (
        <button
          onClick={() => onDelete(document)}
          disabled={deleting}
          className="mt-3 text-xs font-medium text-slate-400 transition hover:text-red-500 disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}