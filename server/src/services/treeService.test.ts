import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { TreeService } from './treeService.js';
import { AppError } from '../errors.js';
import type { TreeType } from '../types.js';

describe('TreeService property tests', () => {
  let db: Database.Database;
  let service: TreeService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new TreeService(db);
  });

  afterEach(() => {
    db.close();
  });

  // Feature: client-intelligence-tree, Property 1: Tree creation round-trip
  it('Property 1: creating a tree and retrieving it preserves the client name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (clientName) => {
          const tree = service.createTree(clientName, 'client');
          const retrieved = service.getTree(tree.id);
          expect(retrieved.clientName).toBe(clientName.trim());
          expect(retrieved.id).toBe(tree.id);
          expect(retrieved.createdAt).toBeTruthy();
          expect(retrieved.updatedAt).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 2: Empty client name rejection
  it('Property 2: whitespace-only or empty client names are rejected', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
        (whitespace) => {
          expect(() => service.createTree(whitespace, 'client')).toThrow(AppError);
          expect(() => service.createTree(whitespace, 'client')).toThrow('Client name must not be empty');
        }
      ),
      { numRuns: 100 }
    );

    // Also verify the empty string case explicitly
    expect(() => service.createTree('', 'client')).toThrow(AppError);
  });

  // Feature: client-intelligence-tree, Property 3: Dashboard lists all trees with required fields
  it('Property 3: listTrees returns all created trees with required fields', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 20 }
        ),
        (clientNames) => {
          // Fresh DB for each run
          const localDb = createDatabase({ inMemory: true });
          const localService = new TreeService(localDb);

          const createdIds = clientNames.map((name) => localService.createTree(name, 'client').id);
          const listed = localService.listTrees();

          // All created trees should be present
          expect(listed.length).toBe(createdIds.length);

          for (const summary of listed) {
            expect(createdIds).toContain(summary.id);
            expect(summary.clientName).toBeTruthy();
            expect(summary.createdAt).toBeTruthy();
            expect(typeof summary.documentCount).toBe('number');
            expect(summary.documentCount).toBe(0);
            expect(summary.researchStatus).toBe('none');
            expect(summary.treeStatus).toBe('none');
          }

          localDb.close();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TreeService tree type', () => {
  let db: Database.Database;
  let service: TreeService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new TreeService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('createTree stores and returns treeType "client"', () => {
    const tree = service.createTree('Acme Corp', 'client');
    expect(tree.treeType).toBe('client');

    const retrieved = service.getTree(tree.id);
    expect(retrieved.treeType).toBe('client');
  });

  it('createTree stores and returns treeType "subject"', () => {
    const tree = service.createTree('Gaming Industry', 'subject');
    expect(tree.treeType).toBe('subject');

    const retrieved = service.getTree(tree.id);
    expect(retrieved.treeType).toBe('subject');
  });

  it('listTrees includes treeType for each tree', () => {
    service.createTree('Client A', 'client');
    service.createTree('Subject B', 'subject');

    const listed = service.listTrees();
    expect(listed.length).toBe(2);

    const types = listed.map((t) => t.treeType).sort();
    expect(types).toEqual(['client', 'subject']);
  });

  it('throws VALIDATION_ERROR for invalid treeType', () => {
    expect(() => service.createTree('Test', 'invalid' as TreeType)).toThrow(AppError);
    try {
      service.createTree('Test', 'invalid' as TreeType);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VALIDATION_ERROR');
    }
  });
});

/**
 * Property 15: Tree creation always stores the specified tree type
 * For any TreeType value ('client' or 'subject'), creating a tree with that type
 * results in the stored tree having treeType equal to the specified value.
 * **Validates: Requirements 6.2**
 */
describe('Property 15: Tree creation always stores the specified tree type', () => {
  let db: Database.Database;
  let service: TreeService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new TreeService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('Property 15: createTree stores and returns the specified tree type for any valid TreeType', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('client' as TreeType, 'subject' as TreeType),
        (clientName, treeType) => {
          const tree = service.createTree(clientName, treeType);

          // The returned tree should have the specified treeType
          expect(tree.treeType).toBe(treeType);

          // Retrieving the tree should also have the specified treeType
          const retrieved = service.getTree(tree.id);
          expect(retrieved.treeType).toBe(treeType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
