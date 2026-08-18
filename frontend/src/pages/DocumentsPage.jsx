import { useCallback, useEffect, useRef, useState } from 'react';
import { documentsApi, knowledgeBasesApi } from '../api/endpoints';
import DocumentCard from '../components/DocumentCard';
import UploadDropzone from '../components/UploadDropzone';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [kbs, setKbs] = useState([]);
  const [selectedKbId, setSelectedKbId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [docList, kbList] = await Promise.all([documentsApi.list(), knowledgeBasesApi.list()]);
      setDocuments(docList);
      setKbs(kbList);
    } catch {
      /* interceptor handles auth */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = documents.some((d) => d.status === 'pending' || d.status === 'processing');
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(refresh, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [documents, refresh]);

  const handleUpload = async (file) => {
    setError('');
    setUploading(true);
    try {
      await documentsApi.upload(file, selectedKbId || undefined);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete "${document.filename}"?`)) return;
    setDeletingId(document.id);
    setError('');
    try {
      await documentsApi.remove(document.id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Documents</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Files are embedded and searchable from chat. Assign them to a knowledge base.
      </p>

      <div className="mb-3 flex items-center justify-end gap-2">
        <label className="text-sm text-slate-500 dark:text-slate-400">Upload to:</label>
        <select
          value={selectedKbId}
          onChange={(e) => setSelectedKbId(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Default</option>
          {kbs.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name}
            </option>
          ))}
        </select>
      </div>
      <UploadDropzone onUpload={handleUpload} uploading={uploading} />
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            kbs={kbs}
            onDelete={handleDelete}
            deleting={deletingId === doc.id}
          />
        ))}
        {documents.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
            No documents uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}