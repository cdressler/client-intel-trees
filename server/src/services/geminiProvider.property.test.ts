/**
 * Property-Based Tests for GeminiProvider error wrapping
 *
 * **Validates: Requirements 3.7**
 *
 * Property 10: Gemini API errors are wrapped as AIProviderError with provider 'gemini'
 * For any error thrown by the Google Generative AI SDK, the GeminiProvider should catch it
 * and throw an AIProviderError whose `provider` field is 'gemini'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GeminiProvider } from './geminiProvider.js';
import { AIProviderError } from '../errors.js';
import type { DocumentContent, DocumentInsights, ResearchFindings } from '../types.js';

// Mock @google/generative-ai
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Minimal valid inputs for each method
const sampleDocs: DocumentContent[] = [
  { id: 'd1', fileName: 'test.pdf', extractedText: 'some text' },
];

const sampleInsights: DocumentInsights = {
  insights: [{ documentId: 'd1', fileName: 'test.pdf', keyThemes: ['growth'], summary: 'summary' }],
};

const sampleFindings: ResearchFindings = {
  clientName: 'Acme',
  findings: [{ category: 'recent_news', title: 'News', summary: 'summary', source: 'src' }],
};

// Arbitrary: generate arbitrary Error objects with varied messages
const arbErrorMessage = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 200 }),
  // HTTP status codes commonly seen in SDK errors
  fc.constantFrom(
    '400 Bad Request',
    '401 Unauthorized',
    '403 Forbidden',
    '404 Not Found',
    '429 Too Many Requests',
    '500 Internal Server Error',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '504 Gateway Timeout',
    'network error',
    'fetch failed',
    'ECONNRESET',
    'ENOTFOUND',
    'rate limit exceeded',
    'quota exceeded',
    'invalid api key',
    'model not found',
  ),
  // Random strings that might appear in SDK errors
  fc.string({ minLength: 1, maxLength: 100 }).map((s) => `SDK error: ${s}`),
);

// Arbitrary: generate arbitrary Error instances (plain Error or subclasses)
const arbError = fc.oneof(
  arbErrorMessage.map((msg) => new Error(msg)),
  arbErrorMessage.map((msg) => new TypeError(msg)),
  arbErrorMessage.map((msg) => new RangeError(msg)),
  // Non-Error throwables (strings, objects, numbers)
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.integer({ min: 400, max: 599 }),
  fc.record({
    message: fc.string({ minLength: 1, maxLength: 50 }),
    status: fc.integer({ min: 400, max: 599 }),
  }),
);

describe('Property 10: Gemini API errors are wrapped as AIProviderError with provider "gemini"', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();

    // Speed up retry delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    provider = new GeminiProvider('test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('analyzeDocuments: any SDK error is wrapped as AIProviderError with provider "gemini"', async () => {
    await fc.assert(
      fc.asyncProperty(arbError, async (thrownValue) => {
        mockGenerateContent.mockReset();
        mockGenerateContent.mockRejectedValue(thrownValue);

        let caught: unknown;
        try {
          await provider.analyzeDocuments(sampleDocs);
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AIProviderError);
        expect((caught as AIProviderError).provider).toBe('gemini');
      }),
      { numRuns: 100 }
    );
  });

  it('researchClient: any SDK error is wrapped as AIProviderError with provider "gemini"', async () => {
    await fc.assert(
      fc.asyncProperty(arbError, async (thrownValue) => {
        mockGenerateContent.mockReset();
        mockGenerateContent.mockRejectedValue(thrownValue);

        let caught: unknown;
        try {
          await provider.researchClient('Acme');
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AIProviderError);
        expect((caught as AIProviderError).provider).toBe('gemini');
      }),
      { numRuns: 100 }
    );
  });

  it('generateDecisionTree: any SDK error is wrapped as AIProviderError with provider "gemini"', async () => {
    await fc.assert(
      fc.asyncProperty(arbError, async (thrownValue) => {
        mockGenerateContent.mockReset();
        mockGenerateContent.mockRejectedValue(thrownValue);

        let caught: unknown;
        try {
          await provider.generateDecisionTree(sampleInsights, sampleFindings);
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AIProviderError);
        expect((caught as AIProviderError).provider).toBe('gemini');
      }),
      { numRuns: 100 }
    );
  });

  it('researchClient with briefText: any SDK error is wrapped as AIProviderError with provider "gemini"', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbError,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (thrownValue, briefText) => {
          mockGenerateContent.mockReset();
          mockGenerateContent.mockRejectedValue(thrownValue);

          let caught: unknown;
          try {
            await provider.researchClient('Acme', briefText);
          } catch (err) {
            caught = err;
          }

          expect(caught).toBeInstanceOf(AIProviderError);
          expect((caught as AIProviderError).provider).toBe('gemini');
        }
      ),
      { numRuns: 100 }
    );
  });
});
