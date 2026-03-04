import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getProviderClient } from './providerFactory.js';
import { GeminiProvider } from './geminiProvider.js';
import type { AIProvider } from '../types.js';

// Feature: client-intelligence-tree, Property 15: Provider factory resolves valid implementations
describe('Property 15: Provider factory resolves valid implementations', () => {
  const validProviders: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should return an AIProviderClient whose providerName matches the requested provider', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validProviders),
        (provider: AIProvider) => {
          const client = getProviderClient(provider);
          expect(client).toBeDefined();
          expect(client.providerName).toBe(provider);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Requirements: 3.5
describe('getProviderClient gemini', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('returns a GeminiProvider instance for provider "gemini"', () => {
    const client = getProviderClient('gemini');
    expect(client).toBeInstanceOf(GeminiProvider);
    expect(client.providerName).toBe('gemini');
  });
});
