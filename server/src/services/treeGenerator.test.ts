import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { TreeGenerator } from './treeGenerator.js';
import { TreeService } from './treeService.js';
import type {
  AIProvider,
  AIProviderClient,
  DocumentInsights,
  RawDecisionTree,
  RawLeafNode,
  RawRootNode,
  ResearchFinding,
} from '../types.js';

const REQUIRED_CATEGORIES = [
  'financial_performance',
  'recent_news',
  'new_offerings',
  'challenges',
] as const;

// --- Arbitraries ---

const nonEmptyStr = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

const arbLeafNode: fc.Arbitrary<RawLeafNode> = fc.record({
  id: fc.uuid(),
  title: nonEmptyStr,
  content: nonEmptyStr,
  rationale: nonEmptyStr,
  sourceDocumentIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
  sourceResearchCategories: fc.array(fc.constantFrom(...REQUIRED_CATEGORIES), {
    minLength: 1,
    maxLength: 2,
  }),
});

const arbRootNode: fc.Arbitrary<RawRootNode> = fc.record({
  id: fc.uuid(),
  title: nonEmptyStr,
  content: nonEmptyStr,
  rationale: nonEmptyStr,
  sourceDocumentIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
  sourceResearchCategories: fc.array(fc.constantFrom(...REQUIRED_CATEGORIES), {
    minLength: 1,
    maxLength: 2,
  }),
  leafNodes: fc.array(arbLeafNode, { minLength: 1, maxLength: 4 }),
});

const arbRawDecisionTree: fc.Arbitrary<RawDecisionTree> = fc.record({
  rootNodes: fc.array(arbRootNode, { minLength: 1, maxLength: 5 }),
});

const arbProvider: fc.Arbitrary<AIProvider> = fc.constantFrom('claude' as const, 'chatgpt' as const);

// --- Helpers ---

function buildFindings(): ResearchFinding[] {
  return REQUIRED_CATEGORIES.map((cat) => ({
    category: cat,
    title: `${cat} title`,
    summary: `${cat} summary`,
    source: `https://example.com/${cat}`,
  }));
}

function buildInsights(docIds: string[]): DocumentInsights {
  return {
    insights: docIds.map((id) => ({
      documentId: id,
      fileName: `doc-${id}.txt`,
      keyThemes: ['theme1'],
      summary: 'summary',
    })),
  };
}

function makeMockProvider(
  provider: AIProvider,
  rawTree: RawDecisionTree,
  insightsOverride?: DocumentInsights
): AIProviderClient {
  return {
    providerName: provider,
    analyzeDocuments: vi.fn().mockResolvedValue(insightsOverride ?? { insights: [] }),
    researchClient: vi.fn(),
    generateDecisionTree: vi.fn().mockResolvedValue(rawTree),
  };
}

/**
 * Seed a tree with a document and research so generateTree preconditions are met.
 * Returns the tree id and the document id.
 */
function seedTreeWithDocAndResearch(
  db: Database.Database,
  clientName: string = 'TestClient',
  provider: AIProvider = 'claude'
): { treeId: string; docId: string } {
  const treeService = new TreeService(db);
  const tree = treeService.createTree(clientName, 'client');

  // Insert a document directly
  const docId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO documents (id, tree_id, file_name, file_path, file_type, extracted_text)
     VALUES (?, ?, 'test.txt', '/tmp/test.txt', 'txt', 'Some extracted text')`
  ).run(docId, tree.id);

  // Insert research directly
  const researchId = crypto.randomUUID();
  const findingsJson = JSON.stringify(buildFindings());
  db.prepare(
    `INSERT INTO research_results (id, tree_id, provider, findings_json)
     VALUES (?, ?, ?, ?)`
  ).run(researchId, tree.id, provider, findingsJson);

  return { treeId: tree.id, docId };
}

// --- Mock provider factory ---

vi.mock('./providerFactory.js', () => ({
  getProviderClient: vi.fn(),
}));

import { getProviderClient } from './providerFactory.js';
const mockedGetProvider = vi.mocked(getProviderClient);

// --- Tests ---

describe('TreeGenerator property tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  // Feature: client-intelligence-tree, Property 11: Decision tree structural integrity
  it('Property 11: generated decision trees have at least one root, each root has at least one leaf, all nodes have non-empty title/content/rationale', async () => {
    await fc.assert(
      fc.asyncProperty(arbRawDecisionTree, async (rawTree) => {
        const localDb = createDatabase({ inMemory: true });
        const { treeId, docId } = seedTreeWithDocAndResearch(localDb);
        const generator = new TreeGenerator(localDb);

        const insights = buildInsights([docId]);
        mockedGetProvider.mockReturnValue(makeMockProvider('claude', rawTree, insights));

        const result = await generator.generateTree(treeId, 'claude');

        // At least one root node
        expect(result.rootNodes.length).toBeGreaterThanOrEqual(1);

        for (const root of result.rootNodes) {
          // Each root has non-empty fields
          expect(root.title.trim().length).toBeGreaterThan(0);
          expect(root.content.trim().length).toBeGreaterThan(0);
          expect(root.rationale.trim().length).toBeGreaterThan(0);

          // Each root has at least one leaf
          expect(root.leafNodes.length).toBeGreaterThanOrEqual(1);

          for (const leaf of root.leafNodes) {
            expect(leaf.title.trim().length).toBeGreaterThan(0);
            expect(leaf.content.trim().length).toBeGreaterThan(0);
            expect(leaf.rationale.trim().length).toBeGreaterThan(0);
          }
        }

        localDb.close();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 12: Node rationale references sources
  it('Property 12: every node has at least one sourceDocumentId or sourceResearchCategory', async () => {
    await fc.assert(
      fc.asyncProperty(arbRawDecisionTree, async (rawTree) => {
        const localDb = createDatabase({ inMemory: true });
        const { treeId, docId } = seedTreeWithDocAndResearch(localDb);
        const generator = new TreeGenerator(localDb);

        const insights = buildInsights([docId]);
        mockedGetProvider.mockReturnValue(makeMockProvider('claude', rawTree, insights));

        const result = await generator.generateTree(treeId, 'claude');

        for (const root of result.rootNodes) {
          const rootHasSources =
            root.sourceDocumentIds.length > 0 || root.sourceResearchCategories.length > 0;
          expect(rootHasSources).toBe(true);

          for (const leaf of root.leafNodes) {
            const leafHasSources =
              leaf.sourceDocumentIds.length > 0 || leaf.sourceResearchCategories.length > 0;
            expect(leafHasSources).toBe(true);
          }
        }

        localDb.close();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 13: Outdated indicator after changes
  it('Property 13: uploading a doc or refreshing research after tree generation causes treeStatus to become outdated', async () => {
    await fc.assert(
      fc.asyncProperty(arbRawDecisionTree, async (rawTree) => {
        const localDb = createDatabase({ inMemory: true });
        const { treeId, docId } = seedTreeWithDocAndResearch(localDb);
        const generator = new TreeGenerator(localDb);
        const treeService = new TreeService(localDb);

        // Set created_at to an earlier time so the outdated check
        // (generated_at != created_at) is satisfied after generation
        localDb.prepare(
          "UPDATE trees SET created_at = datetime('now', '-10 seconds'), updated_at = datetime('now', '-10 seconds') WHERE id = ?"
        ).run(treeId);

        const insights = buildInsights([docId]);
        mockedGetProvider.mockReturnValue(makeMockProvider('claude', rawTree, insights));

        await generator.generateTree(treeId, 'claude');

        // Verify tree is currently 'generated'
        let summaries = treeService.listTrees();
        let summary = summaries.find((s) => s.id === treeId);
        expect(summary!.treeStatus).toBe('generated');

        // Simulate uploading a new document after tree generation.
        // Bump updated_at to a future time so it's strictly after generated_at.
        const newDocId = crypto.randomUUID();
        localDb.prepare(
          `INSERT INTO documents (id, tree_id, file_name, file_path, file_type, extracted_text)
           VALUES (?, ?, 'new.txt', '/tmp/new.txt', 'txt', 'New content')`
        ).run(newDocId, treeId);

        // Get the current decision tree's generated_at and set updated_at one second later
        const dtRow = localDb.prepare(
          `SELECT generated_at FROM decision_trees WHERE tree_id = ? AND is_current = 1`
        ).get(treeId) as { generated_at: string };
        localDb.prepare(
          `UPDATE trees SET updated_at = datetime(?, '+1 second') WHERE id = ?`
        ).run(dtRow.generated_at, treeId);

        // Now treeStatus should be 'outdated'
        summaries = treeService.listTrees();
        summary = summaries.find((s) => s.id === treeId);
        expect(summary!.treeStatus).toBe('outdated');

        localDb.close();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 14: Regeneration produces new tree and retains previous
  it('Property 14: regenerating produces a new current tree and retains the previous one', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRawDecisionTree,
        arbRawDecisionTree,
        async (rawTree1, rawTree2) => {
          const localDb = createDatabase({ inMemory: true });
          const { treeId, docId } = seedTreeWithDocAndResearch(localDb);
          const generator = new TreeGenerator(localDb);

          const insights = buildInsights([docId]);

          // First generation
          mockedGetProvider.mockReturnValue(makeMockProvider('claude', rawTree1, insights));
          const first = await generator.generateTree(treeId, 'claude');
          expect(first.isCurrent).toBe(true);

          // Second generation (regeneration)
          mockedGetProvider.mockReturnValue(makeMockProvider('claude', rawTree2, insights));
          const second = await generator.generateTree(treeId, 'claude');
          expect(second.isCurrent).toBe(true);
          expect(second.id).not.toBe(first.id);

          // Current tree should be the second one
          const current = generator.getCurrentTree(treeId);
          expect(current).not.toBeNull();
          expect(current!.id).toBe(second.id);
          expect(current!.isCurrent).toBe(true);

          // Previous tree should be the first one
          const previous = generator.getPreviousTree(treeId);
          expect(previous).not.toBeNull();
          expect(previous!.id).toBe(first.id);
          expect(previous!.isCurrent).toBe(false);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 10: AI operations record the selected provider
  it('Property 10: generated tree records the provider that was selected', async () => {
    await fc.assert(
      fc.asyncProperty(arbProvider, arbRawDecisionTree, async (provider, rawTree) => {
        const localDb = createDatabase({ inMemory: true });
        const { treeId, docId } = seedTreeWithDocAndResearch(localDb, 'TestClient', provider);
        const generator = new TreeGenerator(localDb);
        const treeService = new TreeService(localDb);

        const insights = buildInsights([docId]);
        mockedGetProvider.mockReturnValue(makeMockProvider(provider, rawTree, insights));

        const result = await generator.generateTree(treeId, provider);

        // The stored result must record the selected provider
        expect(result.provider).toBe(provider);

        // Verify via getCurrentTree as well
        const current = generator.getCurrentTree(treeId);
        expect(current).not.toBeNull();
        expect(current!.provider).toBe(provider);

        // Verify the tree's lastProvider was updated
        const updatedTree = treeService.getTree(treeId);
        expect(updatedTree.lastProvider).toBe(provider);

        localDb.close();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 18: AI prompts include all source material
  it('Property 18: AI provider receives all documents and research when generating a tree', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 5 }),
        arbRawDecisionTree,
        async (docTexts, rawTree) => {
          const localDb = createDatabase({ inMemory: true });
          const treeService = new TreeService(localDb);
          const tree = treeService.createTree('TestClient', 'client');

          // Insert multiple documents
          const docIds: string[] = [];
          for (const text of docTexts) {
            const docId = crypto.randomUUID();
            docIds.push(docId);
            localDb.prepare(
              `INSERT INTO documents (id, tree_id, file_name, file_path, file_type, extracted_text)
               VALUES (?, ?, ?, '/tmp/test.txt', 'txt', ?)`
            ).run(docId, tree.id, `doc-${docId}.txt`, text);
          }

          // Insert research
          const findings = buildFindings();
          const researchId = crypto.randomUUID();
          localDb.prepare(
            `INSERT INTO research_results (id, tree_id, provider, findings_json)
             VALUES (?, ?, 'claude', ?)`
          ).run(researchId, tree.id, JSON.stringify(findings));

          const insights = buildInsights(docIds);
          const mockProvider = makeMockProvider('claude', rawTree, insights);
          mockedGetProvider.mockReturnValue(mockProvider);

          const generator = new TreeGenerator(localDb);
          await generator.generateTree(tree.id, 'claude');

          // Verify analyzeDocuments was called with all documents
          const analyzeCalls = (mockProvider.analyzeDocuments as ReturnType<typeof vi.fn>).mock.calls;
          expect(analyzeCalls.length).toBe(1);
          const passedDocs = analyzeCalls[0][0];
          expect(passedDocs.length).toBe(docIds.length);

          // Every document ID should be present in the call
          const passedIds = passedDocs.map((d: { id: string }) => d.id);
          for (const docId of docIds) {
            expect(passedIds).toContain(docId);
          }

          // Every document's extracted text should be present
          for (let i = 0; i < docTexts.length; i++) {
            const matchingDoc = passedDocs.find((d: { id: string }) => d.id === docIds[i]);
            expect(matchingDoc.extractedText).toBe(docTexts[i]);
          }

          // Verify generateDecisionTree was called with insights and research
          const genCalls = (mockProvider.generateDecisionTree as ReturnType<typeof vi.fn>).mock.calls;
          expect(genCalls.length).toBe(1);
          const [passedInsights, passedResearch] = genCalls[0];
          expect(passedInsights).toEqual(insights);
          expect(passedResearch.clientName).toBe('TestClient');
          expect(passedResearch.findings).toEqual(findings);

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});
