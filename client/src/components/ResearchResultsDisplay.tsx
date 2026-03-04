import type { AIProvider, MultiProviderResearchResponse, ResearchFinding, ResearchFindings } from '../types';
import { providerDisplayName } from './ResearchSection';

// --- Pure helpers (exported for testing) ---

/**
 * Returns the list of provider keys present in a MultiProviderResearchResponse.
 */
export function getResultProviders(response: MultiProviderResearchResponse): AIProvider[] {
  return Object.keys(response.results) as AIProvider[];
}

/**
 * Whether the response should render in single-provider mode (no tabs).
 */
export function isSingleProviderResponse(response: MultiProviderResearchResponse): boolean {
  return getResultProviders(response).length === 1;
}

/**
 * Returns the label for a provider section/tab.
 */
export function getProviderSectionLabel(provider: AIProvider): string {
  return providerDisplayName(provider);
}

/**
 * Returns whether a given provider result is an error entry.
 */
export function isProviderError(response: MultiProviderResearchResponse, provider: AIProvider): boolean {
  const entry = response.results[provider];
  return entry != null && typeof entry.error === 'string' && entry.error.length > 0;
}

// --- Category display constants ---

const CATEGORY_LABELS: Record<ResearchFinding['category'], string> = {
  financial_performance: 'Financial Performance',
  recent_news: 'Recent News',
  new_offerings: 'New Offerings',
  challenges: 'Challenges',
};

const CATEGORY_ORDER: ResearchFinding['category'][] = [
  'financial_performance',
  'recent_news',
  'new_offerings',
  'challenges',
];

const CATEGORY_ICONS: Record<ResearchFinding['category'], string> = {
  financial_performance: '📈',
  recent_news: '📰',
  new_offerings: '🚀',
  challenges: '⚠️',
};

// --- React components ---

interface Props {
  response: MultiProviderResearchResponse;
}

export default function ResearchResultsDisplay({ response }: Props) {
  const providers = getResultProviders(response);
  const single = isSingleProviderResponse(response);

  if (single) {
    const result = response.results[providers[0]];
    if (result.error) {
      return (
        <div role="alert" className="alert alert-error text-sm">
          {providerDisplayName(result.provider)} error: {result.error}
        </div>
      );
    }
    return <FindingsDisplay findings={result.findings} provider={result.provider} />;
  }

  return (
    <div className="space-y-4">
      {providers.map((p) => {
        const result = response.results[p];
        return (
          <div key={p} className="collapse collapse-arrow bg-base-100 shadow">
            <input type="checkbox" defaultChecked={p === providers[0]} />
            <div className="collapse-title font-medium">
              {providerDisplayName(p)}
              {result.error && <span className="badge badge-error badge-sm ml-2">Error</span>}
            </div>
            <div className="collapse-content">
              {result.error ? (
                <p className="text-error text-sm">{result.error}</p>
              ) : (
                <FindingsDisplay findings={result.findings} provider={result.provider} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FindingsDisplay({ findings, provider }: { findings?: ResearchFindings; provider: AIProvider }) {
  const items: ResearchFinding[] = findings?.findings ?? [];
  return (
    <div className="space-y-4">
      <div>
        <span className="badge badge-info gap-1 p-3">
          <span aria-hidden="true">🤖</span>
          Researched with {providerDisplayName(provider)}
        </span>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const catFindings = items.filter((f) => f.category === category);
        if (catFindings.length === 0) return null;
        return (
          <div key={category} className="card bg-base-100 shadow">
            <div className="card-body p-0">
              <div className="flex items-center gap-2 px-5 py-3 bg-primary/15 border-b border-primary/20">
                <span aria-hidden="true">{CATEGORY_ICONS[category]}</span>
                <h3 className="font-semibold text-sm text-primary" id={`category-${category}`}>
                  {CATEGORY_LABELS[category]}
                </h3>
              </div>
              <div className="divide-y divide-base-200">
                {catFindings.map((finding, idx) => (
                  <div key={idx} className="px-5 py-4">
                    <p className="font-semibold text-sm text-base-content mb-1">{finding.title}</p>
                    <p className="text-sm text-base-content/70 leading-relaxed mb-2">{finding.summary}</p>
                    <p className="text-xs text-base-content/40">
                      <span className="font-medium">Source:</span> {finding.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
