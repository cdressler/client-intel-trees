import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { ResearchEngine } from './researchEngine.js';
import { TreeService } from './treeService.js';
import type { AIProvider, ResearchFinding, AIProviderClient, MultiProviderResearchResponse } from '../types.js';

const REQUIRED_CATEGORIES = [
  'financial_performance',
  'recent_news',
  'new_offerings',
  'challenges',
] as const;

function makeMockProvider(provider: AIProvider, findings: ResearchFinding[]): AIProviderClient {
  return {
    providerName: provider,
    analyzeDocuments: vi.fn(),
    researchClient: vi.fn().mockResolvedValue({ clientName: 'Test', findings }),
    generateDecisionTree: vi.fn(),
  };
}

function buildFindings(extras: ResearchFinding[] = []): ResearchFinding[] {
  return [
    ...REQUIRED_CATEGORIES.map((cat) => ({
      category: cat,
      title: `${cat} title`,
      summary: `${cat} summary`,
      source: `https://example.com/${cat}`,
    })),
    ...extras,
  ];
}

// Arbitrary for a single ResearchFinding with a guaranteed non-empty source
const findingArb = (category: ResearchFinding['category']) =>
  fc.record({
    category: fc.constant(category),
    title: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    summary: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    source: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  });

// Arbitrary that produces findings covering all four required categories plus optional extras
const fullFindingsArb = fc
  .tuple(
    findingArb('financial_performance'),
    findingArb('recent_news'),
    findingArb('new_offerings'),
    findingArb('challenges'),
    fc.array(fc.constantFrom(...REQUIRED_CATEGORIES).chain((cat) => findingArb(cat)), {
      minLength: 0,
      maxLength: 4,
    })
  )
  .map(([fp, rn, no, ch, extras]) => [fp, rn, no, ch, ...extras]);

vi.mock('./providerFactory.js', () => ({
  getProviderClient: vi.fn(),
}));

import { getProviderClient } from './providerFactory.js';
const mockedGetProvider = vi.mocked(getProviderClient);

describe('ResearchEngine property tests', () => {
  let db: Database.Database;
  let treeService: TreeService;
  let engine: ResearchEngine;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    treeService = new TreeService(db);
    engine = new ResearchEngine(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  // Feature: client-intelligence-tree, Property 8: Research results are categorized with sources
  it('Property 8: research results contain all four categories and every finding has a non-empty source', async () => {
    await fc.assert(
      fc.asyncProperty(fullFindingsArb, async (findings) => {
        const localDb = createDatabase({ inMemory: true });
        const localTreeService = new TreeService(localDb);
        const localEngine = new ResearchEngine(localDb);

        const tree = localTreeService.createTree('TestClient', 'client');
        const mockProvider = makeMockProvider('claude', findings);
        mockedGetProvider.mockReturnValue(mockProvider);

        const result = await localEngine.runResearch(tree.id, 'TestClient', 'claude');

        // All four required categories must be present
        const categories = new Set(result.findings.map((f) => f.category));
        for (const cat of REQUIRED_CATEGORIES) {
          expect(categories.has(cat)).toBe(true);
        }

        // Every finding must have a non-empty source
        for (const finding of result.findings) {
          expect(finding.source).toBeTruthy();
          expect(finding.source.trim().length).toBeGreaterThan(0);
        }

        localDb.close();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 9: Research refresh replaces previous results
  it('Property 9: refreshing research replaces previous results with a new id and completedAt >= original', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (clientName) => {
          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree(clientName, 'client');
          const findings = buildFindings();

          mockedGetProvider.mockReturnValue(makeMockProvider('claude', findings));
          const first = await localEngine.runResearch(tree.id, clientName, 'claude');

          const updatedFindings = buildFindings([
            { category: 'recent_news', title: 'Extra', summary: 'Extra finding', source: 'https://extra.com' },
          ]);
          mockedGetProvider.mockReturnValue(makeMockProvider('claude', updatedFindings));
          const second = await localEngine.runResearch(tree.id, clientName, 'claude');

          // The refreshed result should have a completedAt >= the original
          expect(second.completedAt >= first.completedAt).toBe(true);

          // The UPSERT should have replaced the old result — new id, same tree
          expect(second.id).not.toBe(first.id);
          expect(second.treeId).toBe(first.treeId);

          // Only one research result should exist for this tree
          const retrieved = localEngine.getResearch(tree.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(second.id);

          // The refreshed findings should include the extra entry
          expect(second.findings.length).toBeGreaterThan(first.findings.length);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 10: AI operations record the selected provider
  it('Property 10: stored research result records the provider that was selected', async () => {
    const validProviders: AIProvider[] = ['claude', 'chatgpt'];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validProviders),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (provider, clientName) => {
          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree(clientName, 'client');
          const findings = buildFindings();

          mockedGetProvider.mockReturnValue(makeMockProvider(provider, findings));
          const result = await localEngine.runResearch(tree.id, clientName, provider);

          // The stored result must record the selected provider
          expect(result.provider).toBe(provider);

          // Verify via direct retrieval as well
          const retrieved = localEngine.getResearch(tree.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.provider).toBe(provider);

          // Verify the tree's lastProvider was updated
          const updatedTree = localTreeService.getTree(tree.id);
          expect(updatedTree.lastProvider).toBe(provider);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('ResearchEngine briefText forwarding', () => {
  let db: Database.Database;
  let treeService: TreeService;
  let engine: ResearchEngine;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    treeService = new TreeService(db);
    engine = new ResearchEngine(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('runResearch with briefText calls researchClient with that text', async () => {
    const tree = treeService.createTree('TestClient', 'client');
    const findings = buildFindings();
    const mockProvider = makeMockProvider('claude', findings);
    mockedGetProvider.mockReturnValue(mockProvider);

    await engine.runResearch(tree.id, 'TestClient', 'claude', 'Custom brief text');

    expect(mockProvider.researchClient).toHaveBeenCalledWith('TestClient', 'Custom brief text');
  });

  it('runResearch without briefText calls researchClient with undefined', async () => {
    const tree = treeService.createTree('TestClient', 'client');
    const findings = buildFindings();
    const mockProvider = makeMockProvider('claude', findings);
    mockedGetProvider.mockReturnValue(mockProvider);

    await engine.runResearch(tree.id, 'TestClient', 'claude');

    expect(mockProvider.researchClient).toHaveBeenCalledWith('TestClient', undefined);
  });
});


describe('ResearchEngine brief forwarding property tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Property 6: Brief text is extracted and forwarded to the AI provider
  // **Validates: Requirements 2.1, 2.2, 2.3**
  it('Property 6: for any non-empty briefText, runResearch passes it to researchClient', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (briefText) => {
          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree('TestClient', 'client');
          const findings = buildFindings();
          const mockProvider = makeMockProvider('claude', findings);
          mockedGetProvider.mockReturnValue(mockProvider);

          await localEngine.runResearch(tree.id, 'TestClient', 'claude', briefText);

          expect(mockProvider.researchClient).toHaveBeenCalledWith('TestClient', briefText);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 7: Research without brief uses standard criteria (no briefText)
  // **Validates: Requirements 2.1, 2.2, 2.3**
  it('Property 7: for any research request without a brief, researchClient is called with undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (clientName) => {
          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree(clientName, 'client');
          const findings = buildFindings();
          const mockProvider = makeMockProvider('claude', findings);
          mockedGetProvider.mockReturnValue(mockProvider);

          await localEngine.runResearch(tree.id, clientName, 'claude');

          expect(mockProvider.researchClient).toHaveBeenCalledWith(clientName, undefined);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('ResearchEngine runMultiProviderResearch', () => {
  let db: Database.Database;
  let treeService: TreeService;
  let engine: ResearchEngine;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    treeService = new TreeService(db);
    engine = new ResearchEngine(db);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('returns results for both providers when two providers succeed', async () => {
    const tree = treeService.createTree('TestClient', 'client');
    const findings = buildFindings();

    mockedGetProvider.mockImplementation((provider: AIProvider) => {
      return makeMockProvider(provider, findings);
    });

    const response = await engine.runMultiProviderResearch(tree.id, 'TestClient', ['claude', 'chatgpt']);

    expect(response.results.claude).toBeDefined();
    expect(response.results.claude.provider).toBe('claude');
    expect(response.results.claude.findings).toBeDefined();
    expect(response.results.claude.findings!.clientName).toBe('TestClient');
    expect(response.results.claude.findings!.findings).toEqual(findings);

    expect(response.results.chatgpt).toBeDefined();
    expect(response.results.chatgpt.provider).toBe('chatgpt');
    expect(response.results.chatgpt.findings).toBeDefined();
    expect(response.results.chatgpt.findings!.clientName).toBe('TestClient');
    expect(response.results.chatgpt.findings!.findings).toEqual(findings);
  });

  it('returns error entry for failing provider and results for the other', async () => {
    const tree = treeService.createTree('TestClient', 'client');
    const findings = buildFindings();

    mockedGetProvider.mockImplementation((provider: AIProvider) => {
      if (provider === 'chatgpt') {
        return {
          providerName: 'chatgpt',
          analyzeDocuments: vi.fn(),
          researchClient: vi.fn().mockRejectedValue(new Error('ChatGPT API error')),
          generateDecisionTree: vi.fn(),
        } as AIProviderClient;
      }
      return makeMockProvider(provider, findings);
    });

    const response = await engine.runMultiProviderResearch(tree.id, 'TestClient', ['claude', 'chatgpt']);

    expect(response.results.claude).toBeDefined();
    expect(response.results.claude.provider).toBe('claude');
    expect(response.results.claude.findings).toBeDefined();
    expect(response.results.claude.error).toBeUndefined();

    expect(response.results.chatgpt).toBeDefined();
    expect(response.results.chatgpt.provider).toBe('chatgpt');
    expect(response.results.chatgpt.error).toBe('ChatGPT API error');
    expect(response.results.chatgpt.findings).toBeUndefined();
  });
});


describe('ResearchEngine multi-provider fan-out property tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allProviders: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

  // Property 23: Multi-provider response contains one result per requested provider
  // **Validates: Requirements 11.6, 11.7, 11.8**
  it('Property 23: for any non-empty array of valid providers, runMultiProviderResearch returns one result per provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.constantFrom(...allProviders), { minLength: 1, maxLength: 3 }),
        async (providers) => {
          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree('TestClient', 'client');
          const findings = buildFindings();

          mockedGetProvider.mockImplementation((provider: AIProvider) => {
            return makeMockProvider(provider, findings);
          });

          const response = await localEngine.runMultiProviderResearch(tree.id, 'TestClient', providers);

          // Should have exactly one entry per requested provider
          const resultKeys = Object.keys(response.results);
          expect(resultKeys.length).toBe(providers.length);
          for (const p of providers) {
            expect(response.results[p]).toBeDefined();
            expect(response.results[p].provider).toBe(p);
          }

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 24: A single failing provider does not suppress other providers' results
  // **Validates: Requirements 11.6, 11.7, 11.8**
  it('Property 24: when exactly one provider throws, the response has an error for that provider and findings for all others', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.constantFrom(...allProviders), { minLength: 2, maxLength: 3 }),
        fc.nat().map(n => n), // index selector
        async (providers, indexSeed) => {
          const failIndex = indexSeed % providers.length;
          const failingProvider = providers[failIndex];

          const localDb = createDatabase({ inMemory: true });
          const localTreeService = new TreeService(localDb);
          const localEngine = new ResearchEngine(localDb);

          const tree = localTreeService.createTree('TestClient', 'client');
          const findings = buildFindings();

          mockedGetProvider.mockImplementation((provider: AIProvider) => {
            if (provider === failingProvider) {
              return {
                providerName: provider,
                analyzeDocuments: vi.fn(),
                researchClient: vi.fn().mockRejectedValue(new Error(`${provider} failed`)),
                generateDecisionTree: vi.fn(),
              } as AIProviderClient;
            }
            return makeMockProvider(provider, findings);
          });

          const response = await localEngine.runMultiProviderResearch(tree.id, 'TestClient', providers);

          // The failing provider should have an error entry
          expect(response.results[failingProvider]).toBeDefined();
          expect(response.results[failingProvider].error).toBeDefined();
          expect(response.results[failingProvider].findings).toBeUndefined();

          // All other providers should have findings
          for (const p of providers) {
            if (p !== failingProvider) {
              expect(response.results[p]).toBeDefined();
              expect(response.results[p].findings).toBeDefined();
              expect(response.results[p].error).toBeUndefined();
            }
          }

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});
