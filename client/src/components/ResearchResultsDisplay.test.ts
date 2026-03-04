// Unit tests and property tests for ResearchResultsDisplay
// Validates: Requirements 11.9, 11.11
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getResultProviders,
  isSingleProviderResponse,
  getProviderSectionLabel,
  isProviderError,
} from './ResearchResultsDisplay';
import type { AIProvider, MultiProviderResearchResponse, ProviderResearchResult } from '../types';

// --- Helpers ---

const ALL_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

function makeSuccessResult(provider: AIProvider): ProviderResearchResult {
  return {
    provider,
    findings: {
      clientName: 'Test Client',
      findings: [
        { category: 'recent_news', title: 'Test', summary: 'Summary', source: 'src' },
      ],
    },
  };
}

function makeErrorResult(provider: AIProvider, error = 'Something went wrong'): ProviderResearchResult {
  return { provider, error };
}

function makeResponse(results: ProviderResearchResult[]): MultiProviderResearchResponse {
  const map: Partial<Record<AIProvider, ProviderResearchResult>> = {};
  for (const r of results) map[r.provider] = r;
  return { results: map as Record<AIProvider, ProviderResearchResult> };
}

// --- Unit Tests (Task 21.1) ---

describe('ResearchResultsDisplay unit tests', () => {
  describe('single-provider response renders without tabs', () => {
    it('isSingleProviderResponse returns true for one provider', () => {
      const response = makeResponse([makeSuccessResult('claude')]);
      expect(isSingleProviderResponse(response)).toBe(true);
    });

    it('getResultProviders returns exactly one provider', () => {
      const response = makeResponse([makeSuccessResult('gemini')]);
      expect(getResultProviders(response)).toEqual(['gemini']);
    });
  });

  describe('multi-provider response renders one labeled section per provider', () => {
    it('isSingleProviderResponse returns false for multiple providers', () => {
      const response = makeResponse([
        makeSuccessResult('claude'),
        makeSuccessResult('chatgpt'),
      ]);
      expect(isSingleProviderResponse(response)).toBe(false);
    });

    it('getResultProviders returns all providers in the response', () => {
      const response = makeResponse([
        makeSuccessResult('claude'),
        makeSuccessResult('chatgpt'),
        makeSuccessResult('gemini'),
      ]);
      const providers = getResultProviders(response);
      expect(providers).toHaveLength(3);
      expect(providers).toContain('claude');
      expect(providers).toContain('chatgpt');
      expect(providers).toContain('gemini');
    });

    it('getProviderSectionLabel returns human-readable names', () => {
      expect(getProviderSectionLabel('claude')).toBe('Claude');
      expect(getProviderSectionLabel('chatgpt')).toBe('ChatGPT');
      expect(getProviderSectionLabel('gemini')).toBe('Gemini');
    });
  });

  describe('provider error entry renders an error message', () => {
    it('isProviderError returns true for error entries', () => {
      const response = makeResponse([makeErrorResult('gemini', 'API timeout')]);
      expect(isProviderError(response, 'gemini')).toBe(true);
    });

    it('isProviderError returns false for success entries', () => {
      const response = makeResponse([makeSuccessResult('claude')]);
      expect(isProviderError(response, 'claude')).toBe(false);
    });

    it('mixed response correctly identifies error vs success', () => {
      const response = makeResponse([
        makeSuccessResult('claude'),
        makeErrorResult('chatgpt', 'Rate limited'),
        makeSuccessResult('gemini'),
      ]);
      expect(isProviderError(response, 'claude')).toBe(false);
      expect(isProviderError(response, 'chatgpt')).toBe(true);
      expect(isProviderError(response, 'gemini')).toBe(false);
    });
  });
});

// --- Property Tests (Task 21.2) ---

// Property 25: Research_Results_Display renders one section per provider
// Validates: Requirements 11.9
describe('Property 25: Research_Results_Display renders one section per provider', () => {
  it('getResultProviders returns exactly one entry per provider in the response', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_PROVIDERS, { minLength: 1 }),
        (providers) => {
          const results = providers.map((p) => makeSuccessResult(p));
          const response = makeResponse(results);
          const resultProviders = getResultProviders(response);
          expect(resultProviders).toHaveLength(providers.length);
          for (const p of providers) {
            expect(resultProviders).toContain(p);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('each provider in the response has a non-empty section label', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_PROVIDERS, { minLength: 1 }),
        (providers) => {
          for (const p of providers) {
            const label = getProviderSectionLabel(p);
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('mixed success/error responses still have one entry per provider', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_PROVIDERS, { minLength: 1 }),
        fc.subarray(ALL_PROVIDERS),
        (allProviders, errorProviders) => {
          const errorSet = new Set(errorProviders);
          const results = allProviders.map((p) =>
            errorSet.has(p) ? makeErrorResult(p) : makeSuccessResult(p),
          );
          const response = makeResponse(results);
          expect(getResultProviders(response)).toHaveLength(allProviders.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Property 26: Single-provider response renders without tabs
// Validates: Requirements 11.11
describe('Property 26: Single-provider response renders without tabs', () => {
  it('any single-provider response is identified as single-provider mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        (provider) => {
          const response = makeResponse([makeSuccessResult(provider)]);
          expect(isSingleProviderResponse(response)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('any multi-provider response is not single-provider mode', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_PROVIDERS, { minLength: 2 }),
        (providers) => {
          const results = providers.map((p) => makeSuccessResult(p));
          const response = makeResponse(results);
          expect(isSingleProviderResponse(response)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('single-provider error response is still single-provider mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        fc.string({ minLength: 1, maxLength: 50 }),
        (provider, errorMsg) => {
          const response = makeResponse([makeErrorResult(provider, errorMsg)]);
          expect(isSingleProviderResponse(response)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
