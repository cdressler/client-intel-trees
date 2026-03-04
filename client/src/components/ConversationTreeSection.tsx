import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tree, Document, DecisionTree, RootNode, LeafNode, ConversationNode, AIProvider, MultiProviderResearchResponse } from '../types';
import { generateDecisionTree, getPreviousDecisionTree, ApiError } from '../api';
import ProviderSelector, { useProviderDefault } from './ProviderSelector';
import { useToast } from './Toast';
import { providerDisplayName } from './ResearchSection';

/** Map of provider name to its DecisionTree, used for multi-provider comparison. */
export type ProviderTreeMap = Partial<Record<AIProvider, DecisionTree>>;

interface Props {
  treeId: string;
  tree: Tree;
  documents: Document[];
  research: MultiProviderResearchResponse | null;
  decisionTrees: DecisionTree[];
  /** Providers that were used in the most recent research run. */
  researchedProviders?: AIProvider[];
  onTreeChange: () => void;
  onProviderChange: (provider: AIProvider) => void;
}

// --- Pure helpers (exported for testing) ---

/**
 * Returns the list of provider keys present in a ProviderTreeMap.
 */
export function getProviderTreeKeys(map: ProviderTreeMap): AIProvider[] {
  return Object.keys(map).filter((k) => map[k as AIProvider] != null) as AIProvider[];
}

/**
 * Whether the provider tree map should render in multi-provider tab mode.
 */
export function isMultiProviderTreeView(map: ProviderTreeMap): boolean {
  return getProviderTreeKeys(map).length > 1;
}

/**
 * Returns the tab label for a provider in the tree comparison view.
 */
export function getProviderTreeTabLabel(provider: AIProvider): string {
  return providerDisplayName(provider);
}

function isOutdated(tree: Tree, decisionTree: DecisionTree): boolean {
  return tree.updatedAt > decisionTree.generatedAt;
}

function RationalePanel({ node, onClose }: { node: ConversationNode; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => { (previousFocusRef.current as HTMLElement | null)?.focus(); };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Rationale for ${node.title}`}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="bg-base-100 w-96 max-w-full h-full overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-base text-base-content leading-snug pr-4">{node.title}</h3>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close rationale panel"
            className="btn btn-ghost btn-sm btn-circle text-base-content/50">x</button>
        </div>
        <section className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Rationale</h4>
          <p className="text-sm text-base-content/80 leading-relaxed">{node.rationale}</p>
        </section>
        <section className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Source Work Products</h4>
          {node.sourceDocumentIds.length > 0
            ? <ul className="list-disc list-inside space-y-1">{node.sourceDocumentIds.map((id) => <li key={id} className="text-sm text-base-content/70">{id}</li>)}</ul>
            : <p className="text-sm text-base-content/40">No source documents</p>}
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Source Research Categories</h4>
          {node.sourceResearchCategories.length > 0
            ? <ul className="list-disc list-inside space-y-1">{node.sourceResearchCategories.map((cat) => <li key={cat} className="text-sm text-base-content/70">{cat}</li>)}</ul>
            : <p className="text-sm text-base-content/40">No research categories</p>}
        </section>
      </div>
    </div>
  );
}

function LeafNodeRow({ node, onSelect }: { node: LeafNode; onSelect: (n: ConversationNode) => void }) {
  return (
    <div role="button" tabIndex={0} aria-label={`${node.title} - click to view rationale`}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node); } }}
      className="ml-6 mb-2 p-3 bg-base-200 rounded-lg border border-base-300 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors focus:outline-2 focus:outline-primary">
      <p className="font-medium text-sm text-base-content mb-1">{node.title}</p>
      <p className="text-xs text-base-content/60 leading-relaxed">{node.content}</p>
    </div>
  );
}

function RootNodeCard({ node, onSelect }: { node: RootNode; onSelect: (n: ConversationNode) => void }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="card bg-base-100 shadow mb-3 overflow-hidden">
      <div className="flex items-start gap-2 p-4">
        <button aria-label={expanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
          aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}
          className="btn btn-ghost btn-sm flex-shrink-0 text-lg px-2">
          {expanded ? '▾' : '▸'}
        </button>
        <div role="button" tabIndex={0} aria-label={`${node.title} - click to view rationale`}
          onClick={() => onSelect(node)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node); } }}
          className="flex-1 cursor-pointer focus:outline-2 focus:outline-primary rounded">
          <p className="font-semibold text-sm text-base-content mb-1">{node.title}</p>
          <p className="text-sm text-base-content/70 leading-relaxed">{node.content}</p>
        </div>
      </div>
      {expanded && node.leafNodes.length > 0 && (
        <div className="px-4 pb-4">
          {node.leafNodes.map((leaf) => <LeafNodeRow key={leaf.id} node={leaf} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

function TreeDisplay({ decisionTree, onNodeSelect }: { decisionTree: DecisionTree; onNodeSelect: (n: ConversationNode) => void }) {
  return (
    <div>
      {decisionTree.rootNodes.map((root) => <RootNodeCard key={root.id} node={root} onSelect={onNodeSelect} />)}
    </div>
  );
}

function PreviousTreeModal({ decisionTree, onClose }: { decisionTree: DecisionTree; onClose: () => void }) {
  const [selectedNode, setSelectedNode] = useState<ConversationNode | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => { (previousFocusRef.current as HTMLElement | null)?.focus(); };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Previous tree version"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-base-content mb-1">Previous Tree Version</h2>
            <span className="badge badge-info gap-1">Generated with {providerDisplayName(decisionTree.provider)}</span>
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close previous tree"
            className="btn btn-ghost btn-sm btn-circle">x</button>
        </div>
        <TreeDisplay decisionTree={decisionTree} onNodeSelect={setSelectedNode} />
        {selectedNode && <RationalePanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </div>
    </div>
  );
}

function MultiProviderTreeTabs({ providerTrees, onNodeSelect }: { providerTrees: ProviderTreeMap; onNodeSelect: (n: ConversationNode) => void }) {
  const providers = getProviderTreeKeys(providerTrees);
  const [activeTab, setActiveTab] = useState<AIProvider>(providers[0]);

  const activeTree = providerTrees[activeTab];

  return (
    <div className="space-y-3">
      <div className="tabs tabs-boxed" role="tablist" aria-label="Provider tree comparison">
        {providers.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === activeTab}
            className={`tab ${p === activeTab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(p)}
          >
            {getProviderTreeTabLabel(p)}
          </button>
        ))}
      </div>
      {activeTree && <TreeDisplay decisionTree={activeTree} onNodeSelect={onNodeSelect} />}
    </div>
  );
}

export default function ConversationTreeSection({ treeId, tree, documents, research, decisionTrees, researchedProviders, onTreeChange, onProviderChange }: Props) {
  const { showToast, showProviderError } = useToast();
  const [provider, setProvider] = useState<AIProvider>(useProviderDefault(tree.lastProvider));
  const [loading, setLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllProgress, setGeneratingAllProgress] = useState('');
  const [selectedNode, setSelectedNode] = useState<ConversationNode | null>(null);
  const [previousTree, setPreviousTree] = useState<DecisionTree | null | 'loading'>(null);
  const [showPreviousTree, setShowPreviousTree] = useState(false);

  // Build a map of provider → decision tree from the array
  const treeByProvider: Partial<Record<AIProvider, DecisionTree>> = {};
  for (const dt of decisionTrees) {
    treeByProvider[dt.provider] = dt;
  }

  // The tree for the currently selected provider
  const currentTree = treeByProvider[provider] ?? null;
  const hasAnyTree = decisionTrees.length > 0;

  // If the currently selected provider isn't in the researched providers list, switch to the first one
  useEffect(() => {
    if (researchedProviders && researchedProviders.length > 0 && !researchedProviders.includes(provider)) {
      setProvider(researchedProviders[0]);
    }
  }, [researchedProviders, provider]);

  const executeGenerate = useCallback(async (selectedProvider: AIProvider) => {
    setLoading(true);
    try {
      await generateDecisionTree(treeId, selectedProvider);
      onTreeChange();
      onProviderChange(selectedProvider);
    } catch (err) {
      if (err instanceof ApiError && err.isProviderError) {
        showProviderError(selectedProvider, err.message,
          () => executeGenerate(selectedProvider),
          (sp) => { setProvider(sp); executeGenerate(sp); });
      } else {
        showToast(err instanceof Error ? err.message : 'Tree generation failed');
      }
    } finally {
      setLoading(false);
    }
  }, [treeId, onTreeChange, onProviderChange, showToast, showProviderError]);

  const executeGenerateAll = useCallback(async () => {
    const providers = researchedProviders ?? [];
    if (providers.length === 0) return;
    setGeneratingAll(true);
    try {
      for (const p of providers) {
        setGeneratingAllProgress(providerDisplayName(p));
        await generateDecisionTree(treeId, p);
      }
      onTreeChange();
      onProviderChange(providers[providers.length - 1]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Tree generation failed');
    } finally {
      setGeneratingAll(false);
      setGeneratingAllProgress('');
    }
  }, [treeId, researchedProviders, onTreeChange, onProviderChange, showToast]);

  const handleViewPrevious = useCallback(async () => {
    if (previousTree === 'loading') return;
    if (previousTree !== null) { setShowPreviousTree(true); return; }
    setPreviousTree('loading');
    try {
      const prev = await getPreviousDecisionTree(treeId);
      setPreviousTree(prev);
      if (prev) setShowPreviousTree(true);
      else showToast('No previous version found', 'info');
    } catch {
      setPreviousTree(null);
      showToast('Could not load previous tree version');
    }
  }, [treeId, previousTree, showToast]);

  const missingDocuments = documents.length === 0;
  const missingResearch = research === null;

  // Outdated check: the selected provider's tree was generated before the tree's inputs changed
  const selectedTreeOutdated = currentTree != null && isOutdated(tree, currentTree);
  // No tree for this provider yet, but other providers have trees
  const noTreeForProvider = currentTree == null && hasAnyTree;

  return (
    <div className="space-y-4">
      {missingDocuments && <div role="alert" className="alert alert-warning text-sm">At least one Work Product is required before generating a tree.</div>}
      {missingResearch && <div role="alert" className="alert alert-warning text-sm">Client research must be completed before generating a tree.</div>}
      {selectedTreeOutdated && (
        <div role="alert" className="alert alert-warning text-sm">This tree may be outdated. Documents or research have changed since it was last generated.</div>
      )}
      {noTreeForProvider && !missingDocuments && !missingResearch && (
        <div role="alert" className="alert alert-info text-sm">No tree has been generated with {providerDisplayName(provider)} yet. Click Generate to create one.</div>
      )}
      {!missingDocuments && !missingResearch && (
        <div className="flex items-center gap-3 flex-wrap">
          <ProviderSelector value={provider} onChange={setProvider} disabled={loading || generatingAll} availableProviders={researchedProviders} />
          <button className="btn btn-primary" onClick={() => executeGenerate(provider)} disabled={loading || generatingAll} aria-busy={loading}>
            {loading && <span className="loading loading-spinner loading-sm" />}
            {loading ? `Generating with ${providerDisplayName(provider)}...` : currentTree ? 'Regenerate Tree' : 'Generate Tree'}
          </button>
          {researchedProviders && researchedProviders.length > 1 && (
            <button className="btn btn-secondary" onClick={executeGenerateAll} disabled={loading || generatingAll} aria-busy={generatingAll}>
              {generatingAll && <span className="loading loading-spinner loading-sm" />}
              {generatingAll ? `Generating ${generatingAllProgress}...` : 'Generate All Trees'}
            </button>
          )}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? `Generating conversation tree with ${providerDisplayName(provider)}...` : ''}
        {generatingAll ? `Generating all trees: ${generatingAllProgress}...` : ''}
      </div>
      {currentTree ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge badge-info gap-1 p-3">Generated with {providerDisplayName(currentTree.provider)}</span>
            <button onClick={handleViewPrevious} disabled={previousTree === 'loading'} aria-busy={previousTree === 'loading'}
              className="btn btn-ghost btn-xs underline">
              {previousTree === 'loading' ? 'Loading...' : 'View previous version'}
            </button>
          </div>
          <TreeDisplay decisionTree={currentTree} onNodeSelect={setSelectedNode} />
        </div>
      ) : (
        !loading && !missingDocuments && !missingResearch && !hasAnyTree && (
          <div className="text-center py-16 text-base-content/50">
            <p className="text-4xl mb-3">🌳</p>
            <p>No conversation tree generated yet.</p>
          </div>
        )
      )}
      {selectedNode && <RationalePanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
      {showPreviousTree && previousTree && previousTree !== 'loading' && (
        <PreviousTreeModal decisionTree={previousTree} onClose={() => setShowPreviousTree(false)} />
      )}
    </div>
  );
}
