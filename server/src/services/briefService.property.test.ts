import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { BriefService } from './briefService.js';

describe('BriefService property tests', () => {
  let db: Database.Database;
  let service: BriefService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new BriefService(db);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Property 17: Brief create/read round-trip preserves text content
   * For any valid brief text, creating a brief and then retrieving it by ID
   * should return a brief whose `text` equals the original extracted text.
   * Validates: Requirements 7.1, 7.2
   */
  it('Property 17: Brief create/read round-trip preserves text content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom('pdf', 'docx', 'txt') as fc.Arbitrary<'pdf' | 'docx' | 'txt'>,
        (name, text, fileType) => {
          const created = service.createBrief(name, fileType, text);
          const retrieved = service.getBrief(created.id);

          expect(retrieved.id).toBe(created.id);
          expect(retrieved.text).toBe(text);
          expect(retrieved.name).toBe(name);
          expect(retrieved.fileType).toBe(fileType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18: Brief update replaces content while preserving identity
   * For any existing brief, updating it with new content should result in
   * the same brief ID returning the new text.
   * Validates: Requirements 7.3
   */
  it('Property 18: Brief update replaces content while preserving identity', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom('pdf', 'docx', 'txt') as fc.Arbitrary<'pdf' | 'docx' | 'txt'>,
        fc.constantFrom('pdf', 'docx', 'txt') as fc.Arbitrary<'pdf' | 'docx' | 'txt'>,
        (name, originalText, newText, originalFileType, newFileType) => {
          const created = service.createBrief(name, originalFileType, originalText);
          const updated = service.updateBrief(created.id, newFileType, newText);

          // Identity is preserved
          expect(updated.id).toBe(created.id);
          expect(updated.name).toBe(name);

          // Content is replaced
          const retrieved = service.getBrief(created.id);
          expect(retrieved.text).toBe(newText);
          expect(retrieved.fileType).toBe(newFileType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
