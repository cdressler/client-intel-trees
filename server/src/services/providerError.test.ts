import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AIProviderError } from '../errors.js';
import type { AIProvider } from '../types.js';

// Feature: client-intelligence-tree, Property 17: Provider errors identify the failing provider
describe('Property 17: Provider errors identify the failing provider', () => {
  const validProviders: AIProvider[] = ['claude', 'chatgpt'];

  it('should contain provider, statusCode, and originalMessage for any random AIProviderError', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validProviders),
        fc.integer({ min: 100, max: 599 }),
        fc.string({ minLength: 1 }),
        (provider: AIProvider, statusCode: number, originalMessage: string) => {
          const error = new AIProviderError(provider, statusCode, originalMessage);

          expect(error).toBeInstanceOf(AIProviderError);
          expect(error).toBeInstanceOf(Error);
          expect(error.provider).toBe(provider);
          expect(error.statusCode).toBe(statusCode);
          expect(error.originalMessage).toBe(originalMessage);
          expect(error.name).toBe('AIProviderError');
          expect(error.message).toContain(provider);
          expect(error.message).toContain(String(statusCode));
          expect(error.message).toContain(originalMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
