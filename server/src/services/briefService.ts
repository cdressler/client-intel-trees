import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import { AppError } from '../errors.js';
import type { Brief, BriefDetail } from '../types.js';

interface BriefRow {
  id: string;
  name: string;
  file_type: string;
  text: string;
  created_at: string;
}

export class BriefService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  listBriefs(): Brief[] {
    const rows = this.db
      .prepare('SELECT id, name, file_type, created_at FROM briefs ORDER BY created_at DESC')
      .all() as BriefRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      fileType: row.file_type as Brief['fileType'],
      createdAt: row.created_at,
    }));
  }

  getBrief(id: string): BriefDetail {
    const row = this.db
      .prepare('SELECT id, name, file_type, text, created_at FROM briefs WHERE id = ?')
      .get(id) as BriefRow | undefined;

    if (!row) {
      throw new AppError('NOT_FOUND', `Brief not found: ${id}`);
    }

    return {
      id: row.id,
      name: row.name,
      fileType: row.file_type as Brief['fileType'],
      text: row.text,
      createdAt: row.created_at,
    };
  }

  createBrief(name: string, fileType: string, text: string): Brief {
    const id = uuidv4();

    this.db
      .prepare('INSERT INTO briefs (id, name, file_type, text) VALUES (?, ?, ?, ?)')
      .run(id, name, fileType, text);

    return this.listBriefs().find((b) => b.id === id)!;
  }

  updateBrief(id: string, fileType: string, text: string): Brief {
    // Verify the brief exists first
    this.getBrief(id);

    this.db
      .prepare('UPDATE briefs SET file_type = ?, text = ? WHERE id = ?')
      .run(fileType, text, id);

    return this.listBriefs().find((b) => b.id === id)!;
  }

  deleteBrief(id: string): void {
    const result = this.db
      .prepare('DELETE FROM briefs WHERE id = ?')
      .run(id);

    if (result.changes === 0) {
      throw new AppError('NOT_FOUND', `Brief not found: ${id}`);
    }
  }
}
