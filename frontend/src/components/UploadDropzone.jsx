import { useRef, useState } from 'react';

export default function UploadDropzone({ onUpload, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (file) onUpload(file);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
        dragging ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {uploading ? (
        <p className="text-sm text-slate-500">Uploading and queuing ingestion…</p>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-700">
            Drag &amp; drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF, TXT or Markdown · max 50 MB</p>
        </>
      )}
    </div>
  );
}