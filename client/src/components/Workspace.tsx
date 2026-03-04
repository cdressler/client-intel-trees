import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tree, Document, DecisionTree, AIProvider, MultiProviderResearchResponse } from '../types';
import { getTree, listDocuments, getResearch, getDecisionTree } from '../api';
import { useToast } from './Toast';
import DocumentsSection from './DocumentsSection';
import ResearchSection from './ResearchSection';
import ConversationTreeSection from './ConversationTreeSection';

type Tab = 'documents' | 'research' | 'tree';

const tabLabels: Record<Tab, string> = {
  documents: 'Documents',
  research: 'Research',
  tree: 'Conversation Tree',
};

const tabs: Tab[] = ['documents', 'research', 'tree'];


export default function Workspace() {
  const { treeId } = useParams<{ treeId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('documents');
  const [tree, setTree] = useState<Tree | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [research, setResearch] = useState<MultiProviderResearchResponse | null>(null);
  const [decisionTrees, setDecisionTrees] = useState<DecisionTree[]>([]);
  const [researchedProviders, setResearchedProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    if (!treeId) return;
    try {
      const t = await getTree(treeId);
      setTree(t);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load tree');
    }
  }, [treeId, showToast]);

  const fetchDocuments = useCallback(async () => {
    if (!treeId) return;
    try {
      const docs = await listDocuments(treeId);
      setDocuments(docs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load documents');
    }
  }, [treeId, showToast]);

  const fetchResearch = useCallback(async () => {
    if (!treeId) return;
    try {
      const r = await getResearch(treeId);
      setResearch(r);
      if (r) {
        setResearchedProviders(Object.keys(r.results) as AIProvider[]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load research');
    }
  }, [treeId, showToast]);

  const fetchDecisionTree = useCallback(async () => {
    if (!treeId) return;
    try {
      const dts = await getDecisionTree(treeId);
      setDecisionTrees(dts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load decision tree');
    }
  }, [treeId, showToast]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchTree(), fetchDocuments(), fetchResearch(), fetchDecisionTree()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchTree, fetchDocuments, fetchResearch, fetchDecisionTree]);



  const handleProviderChange = useCallback((provider: AIProvider) => {
    setTree((prev) => prev ? { ...prev, lastProvider: provider } : prev);
  }, []);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, currentTab: Tab) => {
    const currentIndex = tabs.indexOf(currentTab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tabs[(currentIndex + 1) % tabs.length];
      setActiveTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      setActiveTab(prev);
      document.getElementById(`tab-${prev}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(tabs[0]);
      document.getElementById(`tab-${tabs[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(tabs[tabs.length - 1]);
      document.getElementById(`tab-${tabs[tabs.length - 1]}`)?.focus();
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div role="status" aria-live="polite" aria-label="Loading workspace" className="flex flex-col items-center gap-3 text-base-content/60">
          <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
          <p>Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div role="alert" className="alert alert-error max-w-sm">Tree not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-primary text-primary-content shadow-md px-4">
        <button
          onClick={() => navigate('/')}
          aria-label="Back to dashboard"
          className="btn btn-ghost btn-sm text-primary-content mr-2"
        >
          ← Back
        </button>
        <span className="text-lg font-bold truncate">{tree.clientName}</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 workspace-container">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Workspace sections"
          className="tabs tabs-bordered mb-6 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              id={`tab-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(e) => handleTabKeyDown(e, tab)}
              className={`tab tab-lg font-medium whitespace-nowrap ${activeTab === tab ? 'tab-active' : ''}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={-1}
          className="outline-none"
        >
          {activeTab === 'documents' && (
            <DocumentsSection
              treeId={tree.id}
              documents={documents}
              onDocumentsChange={fetchDocuments}
            />
          )}
          {activeTab === 'research' && (
            <ResearchSection
              treeId={tree.id}
              tree={tree}
              research={research}
              onResearchChange={() => { fetchResearch(); fetchTree(); }}
              onProviderChange={handleProviderChange}
              onResearchedProvidersChange={setResearchedProviders}
            />
          )}
          {activeTab === 'tree' && (
            <ConversationTreeSection
              treeId={tree.id}
              tree={tree}
              documents={documents}
              research={research}
              decisionTrees={decisionTrees}
              researchedProviders={researchedProviders}
              onTreeChange={() => { fetchDecisionTree(); fetchTree(); }}
              onProviderChange={handleProviderChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
