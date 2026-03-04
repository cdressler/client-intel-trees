import { useCallback, useEffect, useState } from 'react';
import type { Tree, AIProvider, Brief, MultiProviderResearchResponse } from '../types';
import { runResearch, listBriefs, createBrief, getDefaultProvider, ApiError } from '../api';
import { useToast } from './Toast';
import MultiProviderSelector from './MultiProviderSelector';
import ResearchResultsDisplay from './ResearchResultsDisplay';

type BriefMode = 'none' | 'library' | 'upload';

const VALID_BRIEF_EXTENSIONS = ['pdf', 'docx', 'txt'];

interface Props {
  treeId: string;
  tree: Tree;
  research: MultiProviderResearchResponse | null;
  onResearchChange: () => void;
  onProviderChange: (provider: AIProvider) => void;
  onResearchedProvidersChange?: (providers: AIProvider[]) => void;
}

export function providerDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'claude': return 'Claude';
    case 'chatgpt': return 'ChatGPT';
    case 'gemini': return 'Gemini';
  }
}

export function validateBriefFileExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return VALID_BRIEF_EXTENSIONS.includes(ext);
}

export function getSelectedProvidersAfterToggle(
  current: AIProvider[],
  provider: AIProvider,
  checked: boolean,
): AIProvider[] {
  if (checked) {
    return current.includes(provider) ? current : [...current, provider];
  }
  return current.filter((p) => p !== provider);
}

export default function ResearchSection({ treeId, tree: _tree, research, onResearchChange, onProviderChange, onResearchedProvidersChange }: Props) {
  const { showToast, showProviderError } = useToast();

  // Provider state
  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>([]);
  const [providerSelectionError, setProviderSelectionError] = useState<string | null>(null);

  // Brief state
  const [briefMode, setBriefMode] = useState<BriefMode>('none');
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [briefFileError, setBriefFileError] = useState<string | null>(null);
  const [libraryBriefs, setLibraryBriefs] = useState<Brief[]>([]);

  // Research state
  const [loading, setLoading] = useState(false);
  const [insufficientResults, setInsufficientResults] = useState(false);
  const [multiProviderResponse, setMultiProviderResponse] = useState<MultiProviderResearchResponse | null>(research);

  // Sync multiProviderResponse when research prop changes (e.g. on revisit)
  useEffect(() => {
    if (research && !multiProviderResponse) {
      setMultiProviderResponse(research);
    }
  }, [research]);

  // Load default provider on mount
  useEffect(() => {
    let cancelled = false;
    getDefaultProvider()
      .then((defaultProvider) => {
        if (!cancelled) {
          setSelectedProviders([defaultProvider]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedProviders(['claude']);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch briefs when switching to library mode
  useEffect(() => {
    if (briefMode === 'library') {
      listBriefs()
        .then(setLibraryBriefs)
        .catch(() => showToast('Failed to load briefs'));
    }
  }, [briefMode, showToast]);

  const handleBriefModeChange = useCallback((mode: BriefMode) => {
    setBriefMode(mode);
    if (mode === 'none') {
      setBriefFile(null);
      setSelectedBriefId(null);
      setBriefFileError(null);
    } else if (mode === 'upload') {
      setSelectedBriefId(null);
    } else if (mode === 'library') {
      setBriefFile(null);
      setBriefFileError(null);
    }
  }, []);

  const handleBriefFileChange = useCallback((file: File | null) => {
    if (!file) {
      setBriefFile(null);
      setBriefFileError(null);
      return;
    }
    if (!validateBriefFileExtension(file.name)) {
      setBriefFileError('Only PDF, DOCX, and TXT files are accepted.');
      setBriefFile(null);
      return;
    }
    setBriefFile(file);
    setBriefFileError(null);
  }, []);

  const executeResearch = useCallback(async () => {
    if (selectedProviders.length === 0) {
      setProviderSelectionError('Please select at least one AI provider.');
      return;
    }
    setProviderSelectionError(null);
    setLoading(true);
    setInsufficientResults(false);
    setMultiProviderResponse(null);

    try {
      let activeBriefId: string | undefined;
      let activeBriefFile: File | undefined;

      if (briefMode === 'upload' && briefFile) {
        // Save to library first, then use the returned ID
        const saved = await createBrief(briefFile.name, briefFile);
        activeBriefId = saved.id;
      } else if (briefMode === 'library' && selectedBriefId) {
        activeBriefId = selectedBriefId;
      }

      const response = await runResearch(treeId, selectedProviders, activeBriefFile, activeBriefId);
      setMultiProviderResponse(response);

      // Notify parent of which providers were researched
      const successfulProviders = Object.entries(response.results)
        .filter(([, r]) => !r.error)
        .map(([p]) => p as AIProvider);
      onResearchedProvidersChange?.(successfulProviders.length > 0 ? successfulProviders : selectedProviders);

      // Check if any provider returned results
      const anyFindings = Object.values(response.results).some(
        (r) => r.findings && r.findings.findings && r.findings.findings.length > 0,
      );
      if (!anyFindings) setInsufficientResults(true);

      onResearchChange();
      if (selectedProviders.length === 1) {
        onProviderChange(selectedProviders[0]);
      }
    } catch (err) {
      if (err instanceof ApiError && err.isProviderError && selectedProviders.length === 1) {
        const singleProvider = selectedProviders[0];
        showProviderError(
          singleProvider,
          err.message,
          () => executeResearch(),
          (switchedProvider) => {
            setSelectedProviders([switchedProvider]);
            // Will re-run on next user click
          },
        );
      } else {
        showToast(err instanceof Error ? err.message : 'Research failed');
      }
    } finally {
      setLoading(false);
    }
  }, [treeId, selectedProviders, briefMode, briefFile, selectedBriefId, onResearchChange, onProviderChange, showToast, showProviderError]);

  const providerLabel = selectedProviders.map(providerDisplayName).join(', ');

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-base-content/70">AI Providers:</label>
        <MultiProviderSelector
          selectedProviders={selectedProviders}
          onChange={(providers) => {
            setSelectedProviders(providers);
            setProviderSelectionError(null);
          }}
          disabled={loading}
        />
        {providerSelectionError && (
          <p role="alert" className="text-error text-sm">{providerSelectionError}</p>
        )}
      </div>

      {/* Brief Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-base-content/70">Research Brief:</label>
        <div className="flex items-center gap-4 flex-wrap" role="radiogroup" aria-label="Brief selection mode">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="briefMode"
              className="radio radio-sm radio-primary"
              checked={briefMode === 'none'}
              onChange={() => handleBriefModeChange('none')}
              disabled={loading}
            />
            <span className="text-sm">Standard Criteria</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="briefMode"
              className="radio radio-sm radio-primary"
              checked={briefMode === 'library'}
              onChange={() => handleBriefModeChange('library')}
              disabled={loading}
            />
            <span className="text-sm">Select from Library</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="briefMode"
              className="radio radio-sm radio-primary"
              checked={briefMode === 'upload'}
              onChange={() => handleBriefModeChange('upload')}
              disabled={loading}
            />
            <span className="text-sm">Upload New Brief</span>
          </label>
        </div>

        {briefMode === 'library' && (
          <div className="mt-2">
            {libraryBriefs.length === 0 ? (
              <p className="text-sm text-base-content/50">No briefs in library.</p>
            ) : (
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={selectedBriefId ?? ''}
                onChange={(e) => setSelectedBriefId(e.target.value || null)}
                disabled={loading}
                aria-label="Select a brief from library"
              >
                <option value="">Choose a brief…</option>
                {libraryBriefs.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {briefMode === 'upload' && (
          <div className="mt-2 space-y-1">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="file-input file-input-bordered file-input-sm w-full max-w-xs"
              onChange={(e) => handleBriefFileChange(e.target.files?.[0] ?? null)}
              disabled={loading}
              aria-label="Upload a research brief"
            />
            {briefFileError && (
              <p role="alert" className="text-error text-sm">{briefFileError}</p>
            )}
            {briefFile && !briefFileError && (
              <p className="text-sm text-success" data-testid="brief-file-name">
                Selected: {briefFile.name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Run Button */}
      <div>
        <button
          className="btn btn-primary"
          onClick={executeResearch}
          disabled={loading}
          aria-busy={loading}
          aria-label={loading ? `Researching with ${providerLabel}` : research ? 'Refresh research' : 'Run research'}
        >
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? `Researching with ${providerLabel}…` : research ? 'Refresh Research' : 'Run Research'}
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? `Researching with ${providerLabel}…` : ''}
      </div>

      {insufficientResults && (
        <div role="alert" className="alert alert-warning text-sm">
          No research results found. Please verify the client name is correct.
        </div>
      )}

      {/* Multi-provider results */}
      {multiProviderResponse && !loading && (
        <ResearchResultsDisplay response={multiProviderResponse} />
      )}

      {!multiProviderResponse && !loading && (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-4xl mb-3">🔍</p>
          <p>No research yet. Run research to get started.</p>
        </div>
      )}
    </div>
  );
}
