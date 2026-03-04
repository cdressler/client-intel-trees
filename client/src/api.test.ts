// Property 5: Research request with brief transmits the brief reference
// Validates: Requirements 1.6
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

describe('runResearch — Property 5: brief reference transmission', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset module cache so each test gets a fresh import
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(capturedCalls: { url: string; init: RequestInit }[]) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedCalls.push({ url: String(input), init: init! });
      return new Response(JSON.stringify({ results: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  }

  it('sends briefId in JSON body when briefId is provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.subarray(['claude', 'chatgpt', 'gemini'] as const, { minLength: 1 }),
        async (treeId, briefId, providers) => {
          const calls: { url: string; init: RequestInit }[] = [];
          mockFetch(calls);

          const { runResearch } = await import('./api');
          await runResearch(treeId, [...providers], undefined, briefId);

          expect(calls).toHaveLength(1);
          const body = JSON.parse(calls[0].init.body as string);
          expect(body.briefId).toBe(briefId);
          expect(body.providers).toEqual([...providers]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sends briefFile via FormData when a file is provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('brief.pdf', 'brief.docx', 'brief.txt'),
        fc.subarray(['claude', 'chatgpt', 'gemini'] as const, { minLength: 1 }),
        async (treeId, fileName, providers) => {
          const calls: { url: string; init: RequestInit }[] = [];
          mockFetch(calls);

          const file = new File(['test content'], fileName, { type: 'application/octet-stream' });

          const { runResearch } = await import('./api');
          await runResearch(treeId, [...providers], file);

          expect(calls).toHaveLength(1);
          const formData = calls[0].init.body as FormData;
          expect(formData).toBeInstanceOf(FormData);
          expect(formData.get('briefFile')).toBeTruthy();
          expect(formData.get('briefName')).toBe(fileName);
          expect(formData.get('providers')).toBe(JSON.stringify([...providers]));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not include brief fields when no brief is provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.subarray(['claude', 'chatgpt', 'gemini'] as const, { minLength: 1 }),
        async (treeId, providers) => {
          const calls: { url: string; init: RequestInit }[] = [];
          mockFetch(calls);

          const { runResearch } = await import('./api');
          await runResearch(treeId, [...providers]);

          expect(calls).toHaveLength(1);
          const body = JSON.parse(calls[0].init.body as string);
          expect(body.briefId).toBeUndefined();
          expect(body.providers).toEqual([...providers]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
