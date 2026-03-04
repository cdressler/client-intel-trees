import { describe, it, expect, afterEach } from 'vitest';
import { createDatabase } from './db.js';
import type Database from 'better-sqlite3';

describe('Database initialization', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) db.close();
  });

  it('creates all tables in-memory', () => {
    db = createDatabase({ inMemory: true });

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('trees');
    expect(tableNames).toContain('documents');
    expect(tableNames).toContain('research_results');
    expect(tableNames).toContain('decision_trees');
  });

  it('enables foreign keys', () => {
    db = createDatabase({ inMemory: true });

    const result = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
  });

  it('enforces foreign key constraints', () => {
    db = createDatabase({ inMemory: true });

    expect(() => {
      db.prepare(
        "INSERT INTO documents (id, tree_id, file_name, file_path, file_type) VALUES ('d1', 'nonexistent', 'test.pdf', '/tmp/test.pdf', 'pdf')"
      ).run();
    }).toThrow();
  });

  it('enforces file_type check constraint', () => {
    db = createDatabase({ inMemory: true });

    db.prepare(
      "INSERT INTO trees (id, client_name) VALUES ('t1', 'Test Client')"
    ).run();

    expect(() => {
      db.prepare(
        "INSERT INTO documents (id, tree_id, file_name, file_path, file_type) VALUES ('d1', 't1', 'test.zip', '/tmp/test.zip', 'zip')"
      ).run();
    }).toThrow();
  });

  it('enforces category check constraint', () => {
    db = createDatabase({ inMemory: true });

    db.prepare(
      "INSERT INTO trees (id, client_name) VALUES ('t1', 'Test Client')"
    ).run();

    expect(() => {
      db.prepare(
        "INSERT INTO documents (id, tree_id, file_name, file_path, file_type, category) VALUES ('d1', 't1', 'test.pdf', '/tmp/test.pdf', 'pdf', 'invalid')"
      ).run();
    }).toThrow();
  });

  it('enforces unique (tree_id, provider) on research_results', () => {
    db = createDatabase({ inMemory: true });

    db.prepare("INSERT INTO trees (id, client_name) VALUES ('t1', 'Test')").run();
    db.prepare(
      "INSERT INTO research_results (id, tree_id, provider, findings_json) VALUES ('r1', 't1', 'claude', '[]')"
    ).run();

    // Same tree_id + same provider should fail
    expect(() => {
      db.prepare(
        "INSERT INTO research_results (id, tree_id, provider, findings_json) VALUES ('r2', 't1', 'claude', '[]')"
      ).run();
    }).toThrow();

    // Same tree_id + different provider should succeed
    expect(() => {
      db.prepare(
        "INSERT INTO research_results (id, tree_id, provider, findings_json) VALUES ('r3', 't1', 'chatgpt', '[]')"
      ).run();
    }).not.toThrow();
  });

  it('sets default timestamps on trees', () => {
    db = createDatabase({ inMemory: true });

    db.prepare("INSERT INTO trees (id, client_name) VALUES ('t1', 'Test')").run();
    const row = db.prepare("SELECT created_at, updated_at FROM trees WHERE id = 't1'").get() as {
      created_at: string;
      updated_at: string;
    };

    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  it('provides isolated in-memory databases', () => {
    db = createDatabase({ inMemory: true });
    db.prepare("INSERT INTO trees (id, client_name) VALUES ('t1', 'Test')").run();

    const db2 = createDatabase({ inMemory: true });
    const rows = db2.prepare('SELECT * FROM trees').all();
    expect(rows).toHaveLength(0);
    db2.close();
  });
});
