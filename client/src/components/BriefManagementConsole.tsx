import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Brief } from '../types';
import { listBriefs, createBrief, updateBrief, deleteBrief, ApiError } from '../api';
import { useToast } from './Toast';

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'] as const;
const ACCEPTED_INPUT = '.pdf,.docx,.txt';

export function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isSupportedBriefFile(fileName: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

export function formatBriefDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BriefManagementConsole() {
  const { showToast } = useToast();

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const fetchBriefs = useCallback(async () => {
    try {
      const data = await listBriefs();
      setBriefs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefs();
  }, [fetchBriefs]);

  const handleCreate = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!isSupportedBriefFile(file.name)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await createBrief(file.name, file);
      await fetchBriefs();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to upload brief';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [fetchBriefs]);

  const handleReplace = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingId) return;

    if (!isSupportedBriefFile(file.name)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      setReplacingId(null);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await updateBrief(replacingId, file);
      await fetchBriefs();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to replace brief';
      setError(msg);
    } finally {
      setUploading(false);
      setReplacingId(null);
    }
  }, [replacingId, fetchBriefs]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteBrief(id);
      await fetchBriefs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete brief');
    }
  }, [fetchBriefs, showToast]);

  const startReplace = useCallback((id: string) => {
    setReplacingId(id);
    // Trigger file input after state update
    setTimeout(() => replaceInputRef.current?.click(), 0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Research Briefs</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => createInputRef.current?.click()}
          disabled={uploading}
          aria-busy={uploading}
        >
          {uploading && <span className="loading loading-spinner loading-sm" />}
          {uploading ? 'Uploading…' : 'Upload Brief'}
        </button>
      </div>

      <input
        ref={createInputRef}
        type="file"
        accept={ACCEPTED_INPUT}
        onChange={handleCreate}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPTED_INPUT}
        onChange={handleReplace}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <div role="alert" aria-live="assertive" className="alert alert-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : briefs.length === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-4xl mb-3">📋</p>
          <p>No research briefs yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow">
          <table className="table table-zebra w-full" aria-label="Research briefs">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((brief) => (
                <tr key={brief.id}>
                  <td className="font-mono text-sm break-all">{brief.name}</td>
                  <td>
                    <span className="badge badge-ghost badge-sm uppercase font-semibold">
                      {brief.fileType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-base-content/60">
                    {formatBriefDate(brief.createdAt)}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => startReplace(brief.id)}
                        disabled={uploading}
                        aria-label={`Replace ${brief.name}`}
                      >
                        Replace
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(brief.id)}
                        aria-label={`Delete ${brief.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
