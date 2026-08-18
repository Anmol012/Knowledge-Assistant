import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

export default function SourcesStrip({ sources, expanded, onToggle }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <FileText size={13} />
        Sources · {sources.length}
        {expanded ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
      </button>
      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          {sources.map((source, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {i + 1}
                </span>
                {source.filename}
                <span className="ml-1.5 font-normal text-slate-400">
                  · chunk {source.chunk_index + 1}
                </span>
              </p>
              <p className="line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                {source.snippet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}