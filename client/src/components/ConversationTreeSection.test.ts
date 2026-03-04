// Unit tests for ConversationTreeSection multi-provider view
// Validates: Requirements 11.10, 11.11
import { describe, it, expect } from 'vitest';
import {
  getProviderTreeKeys,
  isMultiProviderTreeView,
  getProviderTreeTabLabel,
} from './ConversationTreeSection';
import type { ProviderTreeMap } from './ConversationTreeSection';
import type { AIProvider, DecisionTree } from '../types';

// --- Helpers ---

function makeDecisionTree(provider: AIProvider): DecisionTree {
  return {
    id: `dt-${provider}`,
    treeId: 'tree-1',
    provider,
    rootNodes: [
      {
        id: 'root-1',
        title: 'Root',
        content: 'Content',
        rationale: 'Rationale',
        sourceDocumentIds: [],
        sourceResearchCategories: [],
        leafNodes: [],
      },
    ],
    isCurrent: true,
    generatedAt: new Date().toISOString(),
  };
}

// --- Unit Tests (Task 22.1) ---

describe('ConversationTreeSection multi-provider view', () => {
  describe('single tree renders without tabs', () => {
    it('isMultiProviderTreeView returns false for a single-provider map', () => {
      const map: ProviderTreeMap = { claude: makeDecisionTree('claude') };
      expect(isMultiProviderTreeView(map)).toBe(false);
    });

    it('getProviderTreeKeys returns one key for a single-provider map', () => {
      const map: ProviderTreeMap = { gemini: makeDecisionTree('gemini') };
      expect(getProviderTreeKeys(map)).toEqual(['gemini']);
    });

    it('isMultiProviderTreeView returns false for an empty map', () => {
      const map: ProviderTreeMap = {};
      expect(isMultiProviderTreeView(map)).toBe(false);
    });
  });

  describe('multiple provider trees render a tab per provider', () => {
    it('isMultiProviderTreeView returns true for two providers', () => {
      const map: ProviderTreeMap = {
        claude: makeDecisionTree('claude'),
        chatgpt: makeDecisionTree('chatgpt'),
      };
      expect(isMultiProviderTreeView(map)).toBe(true);
    });

    it('isMultiProviderTreeView returns true for three providers', () => {
      const map: ProviderTreeMap = {
        claude: makeDecisionTree('claude'),
        chatgpt: makeDecisionTree('chatgpt'),
        gemini: makeDecisionTree('gemini'),
      };
      expect(isMultiProviderTreeView(map)).toBe(true);
    });

    it('getProviderTreeKeys returns all provider keys', () => {
      const map: ProviderTreeMap = {
        claude: makeDecisionTree('claude'),
        gemini: makeDecisionTree('gemini'),
      };
      const keys = getProviderTreeKeys(map);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('claude');
      expect(keys).toContain('gemini');
    });

    it('getProviderTreeTabLabel returns human-readable names', () => {
      expect(getProviderTreeTabLabel('claude')).toBe('Claude');
      expect(getProviderTreeTabLabel('chatgpt')).toBe('ChatGPT');
      expect(getProviderTreeTabLabel('gemini')).toBe('Gemini');
    });
  });

  describe('edge cases', () => {
    it('getProviderTreeKeys filters out undefined entries', () => {
      const map: ProviderTreeMap = {
        claude: makeDecisionTree('claude'),
        chatgpt: undefined,
      };
      expect(getProviderTreeKeys(map)).toEqual(['claude']);
      expect(isMultiProviderTreeView(map)).toBe(false);
    });
  });
});
