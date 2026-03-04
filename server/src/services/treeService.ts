import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import { AppError } from '../errors.js';
import type { Tree, TreeSummary, TreeType, ResearchStatus, TreeGenerationStatus } from '../types.js';

export class TreeService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  createTree(clientName: string, treeType: TreeType): Tree {
    if (!clientName || !clientName.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Client name must not be empty');
    }

    if (treeType !== 'client' && treeType !== 'subject') {
      throw new AppError('VALIDATION_ERROR', `Invalid tree type: ${treeType}. Must be 'client' or 'subject'`);
    }

    const id = uuidv4();
    const trimmed = clientName.trim();

    this.db
      .prepare('INSERT INTO trees (id, client_name, tree_type) VALUES (?, ?, ?)')
      .run(id, trimmed, treeType);

    return this.getTree(id);
  }

  getTree(treeId: string): Tree {
    const row = this.db
      .prepare('SELECT id, client_name, last_provider, tree_type, created_at, updated_at FROM trees WHERE id = ?')
      .get(treeId) as { id: string; client_name: string; last_provider: string | null; tree_type: string; created_at: string; updated_at: string } | undefined;

    if (!row) {
      throw new AppError('NOT_FOUND', `Tree not found: ${treeId}`);
    }

    return {
      id: row.id,
      clientName: row.client_name,
      lastProvider: row.last_provider as Tree['lastProvider'],
      treeType: row.tree_type as TreeType,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTrees(): TreeSummary[] {
    const rows = this.db
      .prepare(`
        SELECT
          t.id,
          t.client_name,
          t.last_provider,
          t.tree_type,
          t.created_at,
          t.updated_at,
          COUNT(DISTINCT d.id) AS document_count,
          CASE
            WHEN EXISTS(SELECT 1 FROM research_results WHERE tree_id = t.id) THEN 'complete'
            ELSE 'none'
          END AS research_status,
          CASE
            WHEN dt.id IS NULL THEN 'none'
            WHEN dt.generated_at < t.updated_at AND dt.generated_at != t.created_at THEN 'outdated'
            ELSE 'generated'
          END AS tree_status
        FROM trees t
        LEFT JOIN documents d ON d.tree_id = t.id
        LEFT JOIN decision_trees dt ON dt.tree_id = t.id AND dt.is_current = 1
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `)
      .all() as Array<{
        id: string;
        client_name: string;
        last_provider: string | null;
        tree_type: string;
        created_at: string;
        updated_at: string;
        document_count: number;
        research_status: string;
        tree_status: string;
      }>;

    return rows.map((row) => ({
      id: row.id,
      clientName: row.client_name,
      lastProvider: row.last_provider as TreeSummary['lastProvider'],
      treeType: row.tree_type as TreeType,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      documentCount: row.document_count,
      researchStatus: row.research_status as ResearchStatus,
      treeStatus: row.tree_status as TreeGenerationStatus,
    }));
  }
}
