import type Database from 'better-sqlite3';

interface SettingRow {
  key: string;
  value: string;
}

export class SettingsService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getSetting(key: string): string | null {
    const row = this.db
      .prepare('SELECT key, value FROM settings WHERE key = ?')
      .get(key) as SettingRow | undefined;

    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, value);
  }
}
