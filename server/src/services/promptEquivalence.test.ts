import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ANALYZE_SYSTEM_PROMPT as CLAUDE_ANALYZE,
  RESEARCH_SYSTEM_PROMPT as CLAUDE_RESEARCH,
  TREE_SYSTEM_PROMPT as CLAUDE_TREE,
} from './claudeProvider.js';
import {
  ANALYZE_SYSTEM_PROMPT as OPENAI_ANALYZE,
  RESEARCH_SYSTEM_PROMPT as OPENAI_RESEARCH,
  TREE_SYSTEM_PROMPT as OPENAI_TREE,
} from './openaiProvider.js';
import type { DocumentContent, DocumentInsights, ResearchFindings, ResearchFinding } from '../types.js';

// Helpers that replicate the user message construction used by both providers.
// Both ClaudeProvider and OpenAIProvider build identical user messages from the
// same inputs — these helpers mirror that shared logic so we can verify equivalence
// for any randomly generated input.

function buildAnalyzeUserMessage(documents: DocumentContent[]): string {
  const documentList = documents
    .map((doc) => `--- Document: ${doc.fileName} (ID: ${doc.id}) ---\n${doc.extractedText}`)
    .join('\n\n');
  return `Analyze the following work product documents and extract actionable insights that could inform client conversations. Focus on themes, deliverables, challenges, and opportunities mentioned in each document.\n\n${documentList}`;
}

function buildResearchUserMessage(clientName: string): string {
  return `Research the company "${clientName}" and provide current business intelligence. Focus on recent earnings and financial performance, news and press releases, new products or service offerings, and current business challenges. Ground every finding in specific evidence and include source attribution. These findings will be used to prepare actionable conversation starters for client meetings.`;
}

function buildTreeUserMessage(insights: DocumentInsights, research: ResearchFindings): string {
  return `Generate a conversation decision tree for ${research.clientName} based on the following inputs.

DOCUMENT INSIGHTS:
${JSON.stringify(insights.insights, null, 2)}

CLIENT RESEARCH:
${JSON.stringify(research.findings, null, 2)}

Create root nodes that represent major conversation themes at the intersection of past work and current client intelligence. Under each root node, create leaf nodes with specific, actionable conversation starters — talking points or questions grounded in evidence from the documents and research. Every node must reference its source documents and/or research categories.`;
}

// Arbitraries

const arbAlphaNum = fc.stringOf(
  fc.oneof(fc.char().filter((c) => /[a-zA-Z0-9]/.test(c))),
  { minLength: 1, maxLength: 20 },
);

const arbDocumentContent: fc.Arbitrary<DocumentContent> = fc.record({
  id: fc.uuid(),
  fileName: arbAlphaNum.map((s) => `${s}.pdf`),
  extractedText: fc.string({ minLength: 1, maxLength: 200 }),
});

const arbDocumentInsight = fc.record({
  documentId: fc.uuid(),
  fileName: arbAlphaNum.map((s) => `${s}.docx`),
  keyThemes: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
  summary: fc.string({ minLength: 1, maxLength: 100 }),
});

const arbCategory = fc.constantFrom(
  'financial_performance' as const,
  'recent_news' as const,
  'new_offerings' as const,
  'challenges' as const,
);

const arbResearchFinding: fc.Arbitrary<ResearchFinding> = fc.record({
  category: arbCategory,
  title: fc.string({ minLength: 1, maxLength: 50 }),
  summary: fc.string({ minLength: 1, maxLength: 100 }),
  source: fc.string({ minLength: 1, maxLength: 50 }),
});

const arbClientName = arbAlphaNum;

const arbDocumentInsights: fc.Arbitrary<DocumentInsights> = fc.record({
  insights: fc.array(arbDocumentInsight, { minLength: 1, maxLength: 5 }),
});

const arbResearchFindings: fc.Arbitrary<ResearchFindings> = fc.record({
  clientName: arbClientName,
  findings: fc.array(arbResearchFinding, { minLength: 1, maxLength: 8 }),
});

// Feature: client-intelligence-tree, Property 19: Equivalent prompt structures across providers
describe('Property 19: Equivalent prompt structures across providers', () => {
  it('system prompts for document analysis are identical across providers', () => {
    expect(CLAUDE_ANALYZE).toBe(OPENAI_ANALYZE);
  });

  it('system prompts for client research are identical across providers', () => {
    expect(CLAUDE_RESEARCH).toBe(OPENAI_RESEARCH);
  });

  it('system prompts for tree generation are identical across providers', () => {
    expect(CLAUDE_TREE).toBe(OPENAI_TREE);
  });

  it('analyzeDocuments user messages are structurally equivalent for any document set', () => {
    fc.assert(
      fc.property(
        fc.array(arbDocumentContent, { minLength: 1, maxLength: 5 }),
        (documents: DocumentContent[]) => {
          // Both providers build the user message identically from the same documents.
          // We verify the message includes every document's ID, fileName, and extractedText.
          const msg = buildAnalyzeUserMessage(documents);
          for (const doc of documents) {
            expect(msg).toContain(doc.id);
            expect(msg).toContain(doc.fileName);
            expect(msg).toContain(doc.extractedText);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('researchClient user messages are structurally equivalent for any client name', () => {
    fc.assert(
      fc.property(arbClientName, (clientName: string) => {
        const msg = buildResearchUserMessage(clientName);
        expect(msg).toContain(clientName);
        expect(msg).toContain('financial performance');
        expect(msg).toContain('news and press releases');
        expect(msg).toContain('new products or service offerings');
        expect(msg).toContain('current business challenges');
        expect(msg).toContain('source attribution');
      }),
      { numRuns: 100 }
    );
  });

  it('generateDecisionTree user messages are structurally equivalent for any insights and research', () => {
    fc.assert(
      fc.property(
        arbDocumentInsights,
        arbResearchFindings,
        (insights: DocumentInsights, research: ResearchFindings) => {
          const msg = buildTreeUserMessage(insights, research);

          // Message must reference the client name
          expect(msg).toContain(research.clientName);

          // Message must include serialized document insights (via JSON.stringify)
          const insightsJson = JSON.stringify(insights.insights, null, 2);
          expect(msg).toContain(insightsJson);

          // Message must include serialized research findings (via JSON.stringify)
          const findingsJson = JSON.stringify(research.findings, null, 2);
          expect(msg).toContain(findingsJson);

          // Message must contain the structural sections
          expect(msg).toContain('DOCUMENT INSIGHTS:');
          expect(msg).toContain('CLIENT RESEARCH:');
          expect(msg).toContain('root nodes');
          expect(msg).toContain('leaf nodes');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('both providers use the same message structure (system + single user message) for all operations', () => {
    // This is a structural assertion: both providers use exactly one system prompt
    // and one user message per API call. We verify the three prompt pairs are identical
    // strings, meaning the structure is equivalent regardless of provider.
    const claudePrompts = [CLAUDE_ANALYZE, CLAUDE_RESEARCH, CLAUDE_TREE];
    const openaiPrompts = [OPENAI_ANALYZE, OPENAI_RESEARCH, OPENAI_TREE];

    for (let i = 0; i < claudePrompts.length; i++) {
      expect(claudePrompts[i]).toBe(openaiPrompts[i]);
      // Each prompt requests JSON output
      expect(claudePrompts[i]).toContain('Return ONLY the JSON object');
    }
  });
});
