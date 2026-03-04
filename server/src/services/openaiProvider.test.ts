import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import { OpenAIProvider } from './openaiProvider.js';
import { AIProviderError } from '../errors.js';
import type { DocumentContent, DocumentInsights, ResearchFindings } from '../types.js';

// Helpers to build OpenAI error instances
function makeAPIError(status: number, message: string): OpenAI.APIError {
  return new OpenAI.APIError(status, { message }, message, new Headers());
}

function makeRateLimitError(retryAfter?: string): OpenAI.RateLimitError {
  const headers = new Headers();
  if (retryAfter) headers.set('retry-after', retryAfter);
  return new OpenAI.RateLimitError(429, { message: 'rate limited' }, 'rate limited', headers);
}

function makeConnectionError(message = 'connection failed'): OpenAI.APIConnectionError {
  return new OpenAI.APIConnectionError({ message });
}

function stubResponse(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
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

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new OpenAIProvider('test-key');
    createSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).client = { chat: { completions: { create: createSpy } } };

    // Replace setTimeout with immediate execution to speed up retry delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('retry logic', () => {
    it('retries on 500+ server errors and succeeds on later attempt', async () => {
      createSpy
        .mockRejectedValueOnce(makeAPIError(500, 'Internal Server Error'))
        .mockRejectedValueOnce(makeAPIError(502, 'Bad Gateway'))
        .mockResolvedValueOnce(stubResponse(sampleInsights));

      const result = await provider.analyzeDocuments(sampleDocs);
      expect(result).toEqual(sampleInsights);
      expect(createSpy).toHaveBeenCalledTimes(3);
    });

    it('retries on connection errors and succeeds on later attempt', async () => {
      createSpy
        .mockRejectedValueOnce(makeConnectionError())
        .mockResolvedValueOnce(stubResponse(sampleFindings));

      const result = await provider.researchClient('Acme');
      expect(result).toEqual(sampleFindings);
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('throws AIProviderError after exhausting all 3 retries on server errors', async () => {
      createSpy
        .mockRejectedValueOnce(makeAPIError(500, 'fail 1'))
        .mockRejectedValueOnce(makeAPIError(500, 'fail 2'))
        .mockRejectedValueOnce(makeAPIError(500, 'fail 3'));

      await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);
      expect(createSpy).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 4xx client errors (except 429)', async () => {
      createSpy.mockRejectedValueOnce(makeAPIError(400, 'Bad Request'));

      await expect(provider.researchClient('Acme')).rejects.toThrow(AIProviderError);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limit handling', () => {
    it('retries on 429 RateLimitError and succeeds', async () => {
      createSpy
        .mockRejectedValueOnce(makeRateLimitError())
        .mockResolvedValueOnce(stubResponse(sampleFindings));

      const result = await provider.researchClient('Acme');
      expect(result).toEqual(sampleFindings);
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('respects Retry-After header on 429 responses', async () => {
      vi.restoreAllMocks(); // restore real setTimeout for this test

      const delays: number[] = [];
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler, ms?: number) => {
        delays.push(ms ?? 0);
        if (typeof fn === 'function') fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      createSpy
        .mockRejectedValueOnce(makeRateLimitError('3'))
        .mockResolvedValueOnce(stubResponse(sampleInsights));

      await provider.analyzeDocuments(sampleDocs);

      // The sleep should have been called with 3000ms (Retry-After: 3 * 1000)
      expect(delays).toContain(3000);
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff when no Retry-After header', async () => {
      vi.restoreAllMocks();

      const delays: number[] = [];
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler, ms?: number) => {
        delays.push(ms ?? 0);
        if (typeof fn === 'function') fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      createSpy
        .mockRejectedValueOnce(makeRateLimitError()) // no Retry-After
        .mockRejectedValueOnce(makeRateLimitError())
        .mockRejectedValueOnce(makeRateLimitError());

      await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);

      // Exponential backoff: attempt 0 → 1000ms, attempt 1 → 2000ms
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
    });

    it('throws AIProviderError after exhausting retries on rate limit', async () => {
      createSpy
        .mockRejectedValueOnce(makeRateLimitError())
        .mockRejectedValueOnce(makeRateLimitError())
        .mockRejectedValueOnce(makeRateLimitError());

      await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);
      expect(createSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('timeout handling', () => {
    it('wraps connection timeout errors as AIProviderError with 503', async () => {
      createSpy.mockRejectedValue(makeConnectionError('Request timed out'));

      try {
        await provider.researchClient('Acme');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIProviderError);
        const aiErr = err as AIProviderError;
        expect(aiErr.provider).toBe('chatgpt');
        expect(aiErr.statusCode).toBe(503);
        expect(aiErr.originalMessage).toContain('timed out');
      }
    });
  });

  describe('error wrapping in AIProviderError', () => {
    it('wraps APIError with correct provider and status code', async () => {
      createSpy.mockRejectedValue(makeAPIError(401, 'Unauthorized'));

      try {
        await provider.analyzeDocuments(sampleDocs);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIProviderError);
        const aiErr = err as AIProviderError;
        expect(aiErr.provider).toBe('chatgpt');
        expect(aiErr.statusCode).toBe(401);
        expect(aiErr.originalMessage).toBeTruthy();
      }
    });

    it('wraps APIConnectionError with provider "chatgpt" and status 503', async () => {
      createSpy.mockRejectedValue(makeConnectionError('network down'));

      try {
        await provider.researchClient('Test');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIProviderError);
        const aiErr = err as AIProviderError;
        expect(aiErr.provider).toBe('chatgpt');
        expect(aiErr.statusCode).toBe(503);
        expect(aiErr.originalMessage).toBe('network down');
      }
    });

    it('wraps generic errors with provider "chatgpt" and status 500', async () => {
      createSpy.mockRejectedValue(new Error('something unexpected'));

      try {
        await provider.analyzeDocuments(sampleDocs);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIProviderError);
        const aiErr = err as AIProviderError;
        expect(aiErr.provider).toBe('chatgpt');
        expect(aiErr.statusCode).toBe(500);
        expect(aiErr.originalMessage).toBe('something unexpected');
      }
    });

    it('wraps RateLimitError with provider "chatgpt" and status 429', async () => {
      createSpy
        .mockRejectedValueOnce(makeRateLimitError())
        .mockRejectedValueOnce(makeRateLimitError())
        .mockRejectedValueOnce(makeRateLimitError());

      try {
        await provider.generateDecisionTree(sampleInsights, sampleFindings);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIProviderError);
        const aiErr = err as AIProviderError;
        expect(aiErr.provider).toBe('chatgpt');
        expect(aiErr.statusCode).toBe(429);
      }
    });
  });

  describe('successful responses', () => {
    it('analyzeDocuments parses valid JSON response', async () => {
      createSpy.mockResolvedValue(stubResponse(sampleInsights));
      const result = await provider.analyzeDocuments(sampleDocs);
      expect(result).toEqual(sampleInsights);
    });

    it('researchClient parses valid JSON response', async () => {
      createSpy.mockResolvedValue(stubResponse(sampleFindings));
      const result = await provider.researchClient('Acme');
      expect(result).toEqual(sampleFindings);
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
      createSpy.mockResolvedValue(stubResponse(tree));
      const result = await provider.generateDecisionTree(sampleInsights, sampleFindings);
      expect(result).toEqual(tree);
    });

    it('throws AIProviderError when response has no content', async () => {
      createSpy.mockResolvedValue({ choices: [{ message: { content: null } }] });
      await expect(provider.analyzeDocuments(sampleDocs)).rejects.toThrow(AIProviderError);
    });
  });
});
