import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { SettingsService } from './settingsService.js';

describe('SettingsService property tests', () => {
  let db: Database.Database;
  let service: SettingsService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Property 19: Default provider setting round-trip
   * For any valid AIProvider value, setting it as the default and then reading
   * the default should return the same value.
   * Validates: Requirements 10.2
   */
  it('Property 19: Default provider setting round-trip', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('claude', 'chatgpt', 'gemini') as fc.Arbitrary<'claude' | 'chatgpt' | 'gemini'>,
        (provider) => {
          service.setSetting('default_provider', provider);
          const retrieved = service.getSetting('default_provider');
          expect(retrieved).toBe(provider);
        }
      ),
      { numRuns: 100 }
    );
  });
});
