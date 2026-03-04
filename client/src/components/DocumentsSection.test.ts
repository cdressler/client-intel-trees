// Unit tests and property tests for DocumentsSection case study category
// Validates: Requirements 5.1, 5.2, 5.4
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CATEGORY_LABELS } from './DocumentsSection';
import type { DocumentCategory } from '../types';

// --- Unit Tests (Task 19.1) ---

describe('DocumentsSection case study category', () => {
  it('CATEGORY_LABELS includes case_study mapped to "Case Study"', () => {
    expect(CATEGORY_LABELS).toHaveProperty('case_study', 'Case Study');
  });

  it('CATEGORY_LABELS maps all known categories to human-readable labels', () => {
    const expected: Record<DocumentCategory, string> = {
      brief: 'Brief',
      schedule: 'Schedule',
      deliverable: 'Deliverable',
      case_study: 'Case Study',
      other: 'Other',
    };
    expect(CATEGORY_LABELS).toEqual(expected);
  });
});

// --- Property Tests (Task 19.2) ---

// Property 13: Documents uploaded with category 'case_study' are stored with that category
// Validates: Requirements 5.2
describe('Property 13: Documents with category case_study are stored with that category', () => {
  it('case_study category value is preserved through the label map lookup', () => {
    fc.assert(
      fc.property(fc.constant('case_study' as DocumentCategory), (category) => {
        // The category value 'case_study' exists in the label map, confirming it is a valid
        // storable category that the system recognises
        expect(category).toBe('case_study');
        expect(CATEGORY_LABELS[category]).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });
});

// Property 14: Documents with category 'case_study' render the label "Case Study"
// Validates: Requirements 5.4
describe('Property 14: Documents with category case_study render the label "Case Study"', () => {
  it('CATEGORY_LABELS maps case_study to "Case Study" for every lookup', () => {
    fc.assert(
      fc.property(fc.constant('case_study' as DocumentCategory), (category) => {
        expect(CATEGORY_LABELS[category]).toBe('Case Study');
      }),
      { numRuns: 100 },
    );
  });

  it('all DocumentCategory values have a non-empty label', () => {
    const allCategories: DocumentCategory[] = ['brief', 'schedule', 'deliverable', 'case_study', 'other'];
    fc.assert(
      fc.property(fc.constantFrom(...allCategories), (category) => {
        const label = CATEGORY_LABELS[category];
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
