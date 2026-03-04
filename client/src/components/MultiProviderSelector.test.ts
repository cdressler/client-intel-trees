// Unit tests for MultiProviderSelector
// Validates: Requirements 11.1, 11.3
import { describe, it, expect } from 'vitest';
import { toggleProvider, getAvailableProviders } from './MultiProviderSelector';
import type { AIProvider } from '../types';

describe('MultiProviderSelector', () => {
  describe('getAvailableProviders', () => {
    it('returns all three providers (Claude, ChatGPT, Gemini)', () => {
      const providers = getAvailableProviders();
      expect(providers).toEqual(['claude', 'chatgpt', 'gemini']);
      expect(providers).toHaveLength(3);
    });
  });

  describe('toggleProvider', () => {
    it('adds a provider when checked and not already selected', () => {
      const current: AIProvider[] = ['claude'];
      const result = toggleProvider(current, 'gemini', true);
      expect(result).toEqual(['claude', 'gemini']);
    });

    it('does not duplicate a provider when checked and already selected', () => {
      const current: AIProvider[] = ['claude', 'gemini'];
      const result = toggleProvider(current, 'gemini', true);
      expect(result).toEqual(['claude', 'gemini']);
    });

    it('removes a provider when unchecked', () => {
      const current: AIProvider[] = ['claude', 'chatgpt', 'gemini'];
      const result = toggleProvider(current, 'chatgpt', false);
      expect(result).toEqual(['claude', 'gemini']);
    });

    it('returns empty array when unchecking the last provider', () => {
      const current: AIProvider[] = ['claude'];
      const result = toggleProvider(current, 'claude', false);
      expect(result).toEqual([]);
    });

    it('no-ops when unchecking a provider not in the list', () => {
      const current: AIProvider[] = ['claude'];
      const result = toggleProvider(current, 'gemini', false);
      expect(result).toEqual(['claude']);
    });

    it('calls onChange with updated array when checking a provider', () => {
      // Simulates the component behavior: onChange receives the result of toggleProvider
      const selectedProviders: AIProvider[] = ['claude'];
      const onChangeCalls: AIProvider[][] = [];
      const onChange = (providers: AIProvider[]) => onChangeCalls.push(providers);

      // Simulate checking 'gemini'
      onChange(toggleProvider(selectedProviders, 'gemini', true));
      expect(onChangeCalls).toHaveLength(1);
      expect(onChangeCalls[0]).toEqual(['claude', 'gemini']);
    });

    it('calls onChange with updated array when unchecking a provider', () => {
      const selectedProviders: AIProvider[] = ['claude', 'chatgpt'];
      const onChangeCalls: AIProvider[][] = [];
      const onChange = (providers: AIProvider[]) => onChangeCalls.push(providers);

      // Simulate unchecking 'claude'
      onChange(toggleProvider(selectedProviders, 'claude', false));
      expect(onChangeCalls).toHaveLength(1);
      expect(onChangeCalls[0]).toEqual(['chatgpt']);
    });
  });
});
