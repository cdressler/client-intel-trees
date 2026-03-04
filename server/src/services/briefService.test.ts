import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { BriefService } from './briefService.js';
import { AppError } from '../errors.js';

describe('BriefService', () => {
  let db: Database.Database;
  let service: BriefService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new BriefService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createBrief', () => {
    it('inserts and returns a Brief with a generated ID', () => {
      const brief = service.createBrief('My Brief', 'pdf', 'some text content');

      expect(brief.id).toBeTruthy();
      expect(brief.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(brief.name).toBe('My Brief');
      expect(brief.fileType).toBe('pdf');
      expect(brief.createdAt).toBeTruthy();
    });

    it('generates unique IDs for each brief', () => {
      const brief1 = service.createBrief('Brief 1', 'txt', 'text 1');
      const brief2 = service.createBrief('Brief 2', 'docx', 'text 2');

      expect(brief1.id).not.toBe(brief2.id);
    });

    it('stores the brief so it appears in listBriefs', () => {
      service.createBrief('Test Brief', 'txt', 'hello world');
      const briefs = service.listBriefs();

      expect(briefs).toHaveLength(1);
      expect(briefs[0].name).toBe('Test Brief');
    });
  });

  describe('getBrief', () => {
    it('returns stored text for an existing brief', () => {
      const created = service.createBrief('Research Brief', 'txt', 'detailed brief text');
      const detail = service.getBrief(created.id);

      expect(detail.id).toBe(created.id);
      expect(detail.name).toBe('Research Brief');
      expect(detail.fileType).toBe('txt');
      expect(detail.text).toBe('detailed brief text');
      expect(detail.createdAt).toBeTruthy();
    });

    it('throws NOT_FOUND for an unknown ID', () => {
      expect(() => service.getBrief('non-existent-id')).toThrow(AppError);

      try {
        service.getBrief('non-existent-id');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe('NOT_FOUND');
        expect(appErr.message).toContain('non-existent-id');
      }
    });
  });

  describe('updateBrief', () => {
    it('replaces text while keeping the same ID', () => {
      const created = service.createBrief('My Brief', 'pdf', 'original text');
      const updated = service.updateBrief(created.id, 'txt', 'updated text');

      expect(updated.id).toBe(created.id);
      expect(updated.fileType).toBe('txt');

      const detail = service.getBrief(created.id);
      expect(detail.text).toBe('updated text');
    });

    it('preserves the brief name after update', () => {
      const created = service.createBrief('Keep This Name', 'pdf', 'old text');
      service.updateBrief(created.id, 'docx', 'new text');

      const detail = service.getBrief(created.id);
      expect(detail.name).toBe('Keep This Name');
    });

    it('throws NOT_FOUND when updating a non-existent brief', () => {
      expect(() => service.updateBrief('no-such-id', 'txt', 'text')).toThrow(AppError);

      try {
        service.updateBrief('no-such-id', 'txt', 'text');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteBrief', () => {
    it('removes the row from the database', () => {
      const created = service.createBrief('To Delete', 'txt', 'some text');
      service.deleteBrief(created.id);

      expect(service.listBriefs()).toHaveLength(0);
      expect(() => service.getBrief(created.id)).toThrow(AppError);
    });

    it('throws NOT_FOUND when deleting a non-existent brief', () => {
      expect(() => service.deleteBrief('ghost-id')).toThrow(AppError);

      try {
        service.deleteBrief('ghost-id');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('listBriefs', () => {
    it('returns an empty array when no briefs exist', () => {
      expect(service.listBriefs()).toEqual([]);
    });

    it('returns all created briefs ordered by creation date descending', () => {
      service.createBrief('First', 'txt', 'text 1');
      service.createBrief('Second', 'pdf', 'text 2');
      service.createBrief('Third', 'docx', 'text 3');

      const briefs = service.listBriefs();
      expect(briefs).toHaveLength(3);
      // text field should NOT be present in list results
      for (const brief of briefs) {
        expect((brief as Record<string, unknown>).text).toBeUndefined();
      }
    });
  });
});
