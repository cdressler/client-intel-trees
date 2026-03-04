import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from './geminiProvider.js';
import { AIProviderError, AppError } from '../errors.js';
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

function stubResponse(json: unknown) {
  return { response: { text: () => JSON.stringify(json) } };
}

const sampleInsights: DocumentInsights = {
  insights: [{ documentId: 'd1', fileName: 'test.pdf', keyThemes: ['growth'], summary: 'summary' }],
};

const sampleFindings: ResearchFindings = {
  clientName: 'Acme',
  findings: [{ category: 'recent_news', title: 'News', summary: 'summary', source: 'src' }],
};

const sampleDocs: DocumentContent[] = [
  { id: 'd1', fileName: 'test.pdf', extractedText: 'some text' },
];

describe('GeminiProvider', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();

    // Replace setTimeout with immediate execution to speed up retry delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws AppError with VALIDATION_ERROR when GEMINI_API_KEY is not set', () => {
      delete process.env.GEMINI_API_KEY;

      expect(() => new GeminiProvider()).toThrow(AppError);

      try {
        new GeminiProvider();
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe('VALIDATION_ERROR');
        expect(appErr.message).toContain('GEMINI_API_KEY');
      }
    });

    it('throws AppError with VALIDATION_ERROR when GEMINI_API_KEY is empty string', () => {
      process.env.GEMINI_API_KEY = '';

      expect(() => new GeminiProvider()).toThrow(AppError);
    });

    it('constructs successfully when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'valid-key';
      expect(() => new GeminiProvider()).not.toThrow();
    });

    it('accepts an explicit apiKey argument and does not require env var', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => new GeminiProvider('explicit-key')).not.toThrow();
    });
  });

  describe('error wrapping in AIProviderError', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider('test-key');
    });

    describe('analyzeDocuments', () => {
      it('wraps generic errors as AIProviderError with provider "gemini"', async () => {
        mockGenerateContent.mockRejectedValue(new Error('something unexpected'));

        try {
          await provider.analyzeDocuments(sampleDocs);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(500);
          expect(aiErr.originalMessage).toBe('something unexpected');
        }
      });

      it('wraps 401 errors as AIProviderError with provider "gemini" and status 401', async () => {
        mockGenerateContent.mockRejectedValue(new Error('401 Unauthorized'));

        try {
          await provider.analyzeDocuments(sampleDocs);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(401);
        }
      });

      it('wraps network errors as AIProviderError with provider "gemini" and status 503', async () => {
        mockGenerateContent.mockRejectedValue(new Error('network error'));

        try {
          await provider.analyzeDocuments(sampleDocs);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(503);
        }
      });

      it('retries on 500 errors and throws AIProviderError after exhausting retries', async () => {
        mockGenerateContent
          .mockRejectedValueOnce(new Error('500 Internal Server Error'))
          .mockRejectedValueOnce(new Error('500 Internal Server Error'))
          .mockRejectedValueOnce(new Error('500 Internal Server Error'));

        await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
      });
    });

    describe('researchClient', () => {
      it('wraps generic errors as AIProviderError with provider "gemini"', async () => {
        mockGenerateContent.mockRejectedValue(new Error('something unexpected'));

        try {
          await provider.researchClient('Acme');
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(500);
          expect(aiErr.originalMessage).toBe('something unexpected');
        }
      });

      it('wraps rate limit errors as AIProviderError with provider "gemini" and status 429', async () => {
        mockGenerateContent
          .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
          .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
          .mockRejectedValueOnce(new Error('429 rate limit exceeded'));

        try {
          await provider.researchClient('Acme');
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(429);
        }
      });
    });

    describe('generateDecisionTree', () => {
      it('wraps generic errors as AIProviderError with provider "gemini"', async () => {
        mockGenerateContent.mockRejectedValue(new Error('something unexpected'));

        try {
          await provider.generateDecisionTree(sampleInsights, sampleFindings);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(500);
          expect(aiErr.originalMessage).toBe('something unexpected');
        }
      });

      it('wraps 503 errors as AIProviderError with provider "gemini" and status 503', async () => {
        mockGenerateContent.mockRejectedValue(new Error('503 Service Unavailable'));

        try {
          await provider.generateDecisionTree(sampleInsights, sampleFindings);
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(AIProviderError);
          const aiErr = err as AIProviderError;
          expect(aiErr.provider).toBe('gemini');
          expect(aiErr.statusCode).toBe(503);
        }
      });
    });
  });

  describe('successful responses', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider('test-key');
    });

    it('analyzeDocuments parses valid JSON response', async () => {
      mockGenerateContent.mockResolvedValue(stubResponse(sampleInsights));
      const result = await provider.analyzeDocuments(sampleDocs);
      expect(result).toEqual(sampleInsights);
    });

    it('researchClient parses valid JSON response', async () => {
      mockGenerateContent.mockResolvedValue(stubResponse(sampleFindings));
      const result = await provider.researchClient('Acme');
      expect(result).toEqual(sampleFindings);
    });

    it('researchClient forwards briefText when provided', async () => {
      mockGenerateContent.mockResolvedValue(stubResponse(sampleFindings));
      await provider.researchClient('Acme', 'custom brief text');
      const callArg: string = mockGenerateContent.mock.calls[0][0];
      expect(callArg).toContain('custom brief text');
    });

    it('generateDecisionTree parses valid JSON response', async () => {
      const tree = {
        rootNodes: [{
          id: 'r1', title: 'Theme', content: 'desc', rationale: 'why',
          sourceDocumentIds: ['d1'], sourceResearchCategories: ['recent_news'],
          leafNodes: [{
            id: 'l1', title: 'Point', content: 'talk', rationale: 'because',
            sourceDocumentIds: ['d1'], sourceResearchCategories: ['recent_news'],
          }],
        }],
      };
      mockGenerateContent.mockResolvedValue(stubResponse(tree));
      const result = await provider.generateDecisionTree(sampleInsights, sampleFindings);
      expect(result).toEqual(tree);
    });

    it('throws AIProviderError when response text is empty', async () => {
      mockGenerateContent.mockResolvedValue({ response: { text: () => '' } });
      await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);
    });
  });
});
