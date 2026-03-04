import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TreeSummary, TreeType, ResearchStatus, TreeGenerationStatus } from '../types';
import { listTrees, createTree } from '../api';
import { useToast } from './Toast';

const researchStatusLabels: Record<ResearchStatus, string> = {
  none: 'No Research',
  in_progress: 'Researching',
  complete: 'Research Complete',
  error: 'Error',
};

const treeStatusLabels: Record<TreeGenerationStatus, string> = {
  none: 'Not Generated',
  in_progress: 'Generating Tree',
  generated: 'Tree Generated',
  outdated: 'Outdated Tree',
  error: 'Error',
};

const researchBadgeClass: Record<ResearchStatus, string> = {
  none: 'badge badge-ghost',
  in_progress: 'badge badge-warning',
  complete: 'badge badge-success',
  error: 'badge badge-error',
};

const treeBadgeClass: Record<TreeGenerationStatus, string> = {
  none: 'badge badge-ghost',
  in_progress: 'badge badge-warning',
  generated: 'badge badge-success',
  outdated: 'badge badge-warning',
  error: 'badge badge-error',
};

export const TREE_TYPE_OPTIONS: { value: TreeType; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'subject', label: 'Subject' },
];

export const TREE_TYPE_BADGE_LABELS: Record<TreeType, string> = {
  client: 'CLIENT',
  subject: 'SUBJECT',
};

export function getTreeTypeInputLabel(treeType: TreeType): string {
  return treeType === 'subject' ? 'Subject Name' : 'Client Name';
}

export function getTreeTypeInputPlaceholder(treeType: TreeType): string {
  return treeType === 'subject' ? 'Enter subject name' : 'Enter client name';
}

export function getTreeTypeFormTitle(treeType: TreeType): string {
  return treeType === 'subject' ? 'New Subject Tree' : 'New Client Tree';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [treeType, setTreeType] = useState<TreeType>('client');
  const [nameError, setNameError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTrees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listTrees();
      setTrees(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load trees');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTrees();
  }, [fetchTrees]);

  const handleCreate = async () => {
    const trimmed = clientName.trim();
    if (!trimmed) {
      setNameError(treeType === 'subject' ? 'Please enter a valid subject name' : 'Please enter a valid client name');
      return;
    }
    setNameError('');
    try {
      setCreating(true);
      await createTree(trimmed, treeType);
      setClientName('');
      setTreeType('client');
      setShowForm(false);
      await fetchTrees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create tree');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setShowForm(false);
      setClientName('');
      setTreeType('client');
      setNameError('');
    }
  };

  return (
    <div className="dashboard-container">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-base-content">Client Trees</h1>
          {!showForm && trees.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm(true)}
              aria-label="Create a new client intelligence tree"
            >
              + New Tree
            </button>
          )}
        </div>

        {showForm && (
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title text-base">{getTreeTypeFormTitle(treeType)}</h2>
              <fieldset className="mb-2">
                <legend className="label-text font-medium mb-1">Tree Type</legend>
                <div className="flex gap-4">
                  {TREE_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="treeType"
                        value={opt.value}
                        checked={treeType === opt.value}
                        onChange={() => setTreeType(opt.value)}
                        className="radio radio-primary radio-sm"
                      />
                      <span className="label-text">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="client-name-input" className="label">
                <span className="label-text font-medium">{getTreeTypeInputLabel(treeType)}</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  id="client-name-input"
                  type="text"
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); setNameError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder={getTreeTypeInputPlaceholder(treeType)}
                  autoFocus
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'client-name-error' : undefined}
                  aria-required="true"
                  className={`input input-bordered flex-1 min-w-48 ${nameError ? 'input-error' : ''}`}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={creating}
                  aria-busy={creating}
                >
                  {creating ? <span className="loading loading-spinner loading-sm" /> : null}
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setClientName(''); setTreeType('client'); setNameError(''); }}
                >
                  Cancel
                </button>
              </div>
              {nameError && (
                <p id="client-name-error" role="alert" className="text-error text-sm mt-1">
                  {nameError}
                </p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div role="status" aria-live="polite" aria-label="Loading trees" className="flex flex-col items-center justify-center py-20 gap-3 text-base-content/60">
            <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
            <p>Loading trees…</p>
          </div>
        ) : trees.length === 0 ? (
          <div className="hero py-20">
            <div className="hero-content text-center">
              <div>
                <p className="text-5xl mb-4">🌱</p>
                <h2 className="text-xl font-semibold mb-2">No trees yet</h2>
                <p className="text-base-content/60 mb-4">Create your first client intelligence tree to get started.</p>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create New Tree</button>
              </div>
            </div>
          </div>
        ) : (
          <ul
            aria-label="Client intelligence trees"
            className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 list-none m-0 p-0"
          >
            {trees.map((tree) => (
              <li key={tree.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/trees/${tree.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/trees/${tree.id}`); } }}
                  aria-label={`Open tree for ${tree.clientName}. ${tree.documentCount} document${tree.documentCount !== 1 ? 's' : ''}. Research: ${researchStatusLabels[tree.researchStatus]}. Tree: ${treeStatusLabels[tree.treeStatus]}.`}
                  className="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer h-full"
                >
                  <div className="card-body gap-2 relative overflow-hidden">
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: 0,
                        right: 0,
                        width: '100px',
                        height: '100px',
                        overflow: 'hidden',
                      }}
                      aria-hidden="true"
                    >
                      <div
                        className="font-bold text-white"
                        style={{
                          position: 'absolute',
                          backgroundColor: '#1e3a5f',
                          fontSize: '9px',
                          letterSpacing: '0.05em',
                          lineHeight: '22px',
                          textAlign: 'center',
                          width: '140px',
                          right: '-40px',
                          top: '18px',
                          transform: 'rotate(45deg)',
                        }}
                      >
                        {TREE_TYPE_BADGE_LABELS[tree.treeType]}
                      </div>
                    </div>
                    <h2 className="card-title text-base pr-12">{tree.clientName}</h2>
                    <p className="text-sm text-base-content/60">{tree.documentCount} document{tree.documentCount !== 1 ? 's' : ''}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className={researchBadgeClass[tree.researchStatus]}>
                        {researchStatusLabels[tree.researchStatus]}
                      </span>
                      <span className={treeBadgeClass[tree.treeStatus]}>
                        {treeStatusLabels[tree.treeStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/40 mt-auto pt-2">Created {formatDate(tree.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
