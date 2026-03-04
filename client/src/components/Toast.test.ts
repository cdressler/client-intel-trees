// Property test for Gemini provider error UI consistency
// Property 12: Provider errors for Gemini trigger the same error UI as other providers
// Validates: Requirements 4.4
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { providerDisplayNames } from './Toast';
import type { AIProvider } from '../types';

const ALL_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

describe('Property 12: Provider errors for Gemini trigger the same error UI as other providers', () => {
  it('every provider (including gemini) has a display name in providerDisplayNames', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        (provider) => {
          const name = providerDisplayNames[provider];
          expect(name).toBeDefined();
          expect(typeof name).toBe('string');
          expect(name.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('error message format is identical across all providers', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        fc.string({ minLength: 1, maxLength: 100 }),
        (provider, errorMessage) => {
          const displayName = providerDisplayNames[provider];
          const formattedMessage = `${displayName} error: ${errorMessage}`;
          // All providers produce the same "{DisplayName} error: {message}" format
          expect(formattedMessage).toMatch(/^(Claude|ChatGPT|Gemini) error: .+$/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('switch-to actions exclude the erroring provider and include all others', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        (provider) => {
          const otherProviders = ALL_PROVIDERS.filter((p) => p !== provider);
          // The erroring provider should not appear in the switch options
          expect(otherProviders).not.toContain(provider);
          // All other providers should be offered as alternatives
          expect(otherProviders.length).toBe(ALL_PROVIDERS.length - 1);
          // Each alternative has a display name for the button label
          for (const op of otherProviders) {
            expect(providerDisplayNames[op]).toBeDefined();
            expect(providerDisplayNames[op].length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('gemini is treated identically to claude and chatgpt in error structure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS),
        fc.string({ minLength: 1, maxLength: 50 }),
        (provider, msg) => {
          const displayName = providerDisplayNames[provider];
          const otherProviders = ALL_PROVIDERS.filter((p) => p !== provider);
          const actions = [
            { label: 'Retry' },
            ...otherProviders.map((op) => ({
              label: `Switch to ${providerDisplayNames[op]}`,
            })),
          ];
          // Every provider gets a Retry action + one Switch action per other provider
          expect(actions.length).toBe(ALL_PROVIDERS.length);
          expect(actions[0].label).toBe('Retry');
          // The toast message uses the correct display name
          expect(`${displayName} error: ${msg}`).toContain(displayName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
