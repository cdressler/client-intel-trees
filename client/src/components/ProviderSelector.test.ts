// Feature: client-intelligence-tree, Property 16: Provider selector defaults to last used provider
// Validates: Requirements 7.2, 7.8
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { useProviderDefault, PROVIDER_OPTIONS } from './ProviderSelector';

describe('ProviderSelector', () => {
  describe('PROVIDER_OPTIONS', () => {
    it('includes a Gemini option', () => {
      const geminiOption = PROVIDER_OPTIONS.find((opt) => opt.value === 'gemini');
      expect(geminiOption).toBeDefined();
      expect(geminiOption!.label).toBe('Gemini');
    });

    it('includes Claude, ChatGPT, and Gemini options', () => {
      const values = PROVIDER_OPTIONS.map((opt) => opt.value);
      expect(values).toContain('claude');
      expect(values).toContain('chatgpt');
      expect(values).toContain('gemini');
    });
  });

  describe('useProviderDefault', () => {
    it('Property 16: returns lastProvider when non-null', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('claude' as const, 'chatgpt' as const, 'gemini' as const),
          (provider) => {
            expect(useProviderDefault(provider)).toBe(provider);
          },
        ),
      );
    });

    it('Property 16: defaults to claude when lastProvider is null', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          (nullProvider) => {
            expect(useProviderDefault(nullProvider)).toBe('claude');
          },
        ),
      );
    });
  });
});
