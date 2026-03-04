import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { SettingsService } from './settingsService.js';

describe('SettingsService', () => {
  let db: Database.Database;
  let service: SettingsService;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    service = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getSetting', () => {
    it('returns null for a key that does not exist', () => {
      expect(service.getSetting('nonexistent_key')).toBeNull();
    });

    it('returns the default_provider value seeded by the schema', () => {
      // The schema seeds ('default_provider', 'claude')
      expect(service.getSetting('default_provider')).toBe('claude');
    });
  });

  describe('setSetting / getSetting round-trip', () => {
    it('stores and retrieves a value for a new key', () => {
      service.setSetting('my_key', 'my_value');
      expect(service.getSetting('my_key')).toBe('my_value');
    });

    it('overwrites an existing value for the same key', () => {
      service.setSetting('default_provider', 'chatgpt');
      expect(service.getSetting('default_provider')).toBe('chatgpt');
    });

    it('round-trips all valid AIProvider values for default_provider', () => {
      for (const provider of ['claude', 'chatgpt', 'gemini']) {
        service.setSetting('default_provider', provider);
        expect(service.getSetting('default_provider')).toBe(provider);
      }
    });

    it('stores multiple independent keys without interference', () => {
      service.setSetting('key_a', 'value_a');
      service.setSetting('key_b', 'value_b');

      expect(service.getSetting('key_a')).toBe('value_a');
      expect(service.getSetting('key_b')).toBe('value_b');
    });
  });
});
