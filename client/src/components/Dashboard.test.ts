// Unit tests and property tests for Dashboard tree type UI
// Validates: Requirements 6.1, 6.3
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  TREE_TYPE_OPTIONS,
  TREE_TYPE_BADGE_LABELS,
  getTreeTypeInputLabel,
  getTreeTypeInputPlaceholder,
  getTreeTypeFormTitle,
} from './Dashboard';
import type { TreeType } from '../types';

// --- Unit Tests (Task 20.1) ---

describe('Dashboard tree type UI', () => {
  describe('TREE_TYPE_OPTIONS', () => {
    it('includes both client and subject options', () => {
      const values = TREE_TYPE_OPTIONS.map((opt) => opt.value);
      expect(values).toContain('client');
      expect(values).toContain('subject');
      expect(TREE_TYPE_OPTIONS).toHaveLength(2);
    });

    it('has human-readable labels for each option', () => {
      const clientOpt = TREE_TYPE_OPTIONS.find((opt) => opt.value === 'client');
      const subjectOpt = TREE_TYPE_OPTIONS.find((opt) => opt.value === 'subject');
      expect(clientOpt!.label).toBe('Client');
      expect(subjectOpt!.label).toBe('Subject');
    });
  });

  describe('TREE_TYPE_BADGE_LABELS', () => {
    it('maps client to "CLIENT"', () => {
      expect(TREE_TYPE_BADGE_LABELS.client).toBe('CLIENT');
    });

    it('maps subject to "SUBJECT"', () => {
      expect(TREE_TYPE_BADGE_LABELS.subject).toBe('SUBJECT');
    });
  });

  describe('getTreeTypeInputLabel', () => {
    it('returns "Client Name" for client tree type', () => {
      expect(getTreeTypeInputLabel('client')).toBe('Client Name');
    });

    it('returns "Subject Name" for subject tree type', () => {
      expect(getTreeTypeInputLabel('subject')).toBe('Subject Name');
    });
  });

  describe('getTreeTypeInputPlaceholder', () => {
    it('returns "Enter client name" for client tree type', () => {
      expect(getTreeTypeInputPlaceholder('client')).toBe('Enter client name');
    });

    it('returns "Enter subject name" for subject tree type', () => {
      expect(getTreeTypeInputPlaceholder('subject')).toBe('Enter subject name');
    });
  });

  describe('getTreeTypeFormTitle', () => {
    it('returns "New Client Tree" for client tree type', () => {
      expect(getTreeTypeFormTitle('client')).toBe('New Client Tree');
    });

    it('returns "New Subject Tree" for subject tree type', () => {
      expect(getTreeTypeFormTitle('subject')).toBe('New Subject Tree');
    });
  });
});

// --- Property Test (Task 20.2) ---

// Property 16: Tree_Card badge matches the stored tree type
// **Validates: Requirements 6.3**
describe('Property 16: Tree_Card badge matches the stored tree type', () => {
  const allTreeTypes: TreeType[] = ['client', 'subject'];

  it('TREE_TYPE_BADGE_LABELS returns the correct uppercase badge for any TreeType', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTreeTypes), (treeType) => {
        const badge = TREE_TYPE_BADGE_LABELS[treeType];
        expect(badge).toBe(treeType.toUpperCase());
      }),
      { numRuns: 100 },
    );
  });

  it('every TreeType has a non-empty badge label', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTreeTypes), (treeType) => {
        const badge = TREE_TYPE_BADGE_LABELS[treeType];
        expect(typeof badge).toBe('string');
        expect(badge.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('TREE_TYPE_OPTIONS covers all TreeType values', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTreeTypes), (treeType) => {
        const option = TREE_TYPE_OPTIONS.find((opt) => opt.value === treeType);
        expect(option).toBeDefined();
        expect(option!.label.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
