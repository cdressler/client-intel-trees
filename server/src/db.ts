import Database from 'better-sqlite3';

let dbInstance: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trees (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  last_provider TEXT CHECK(last_provider IN ('claude', 'chatgpt', 'gemini')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('pdf', 'docx', 'pptx', 'xlsx', 'txt')),
  project_name TEXT,
  category TEXT CHECK(category IN ('brief', 'schedule', 'deliverable', 'case_study', 'other')),
  extracted_text TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tree_id) REFERENCES trees(id)
);

CREATE TABLE IF NOT EXISTS research_results (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id),
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'chatgpt', 'gemini')),
  findings_json TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tree_id, provider),
  FOREIGN KEY (tree_id) REFERENCES trees(id)
);

CREATE TABLE IF NOT EXISTS decision_trees (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id),
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'chatgpt', 'gemini')),
  tree_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tree_id) REFERENCES trees(id)
);

CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function applyMigrations(db: Database.Database): void {
  // Add tree_type column if it doesn't exist yet
  const columns = db.pragma('table_info(trees)') as Array<{ name: string }>;
  const hasTreeType = columns.some(col => col.name === 'tree_type');
  if (!hasTreeType) {
    db.exec(`ALTER TABLE trees ADD COLUMN tree_type TEXT NOT NULL DEFAULT 'client'`);
  }

  // Migrate research_results: change UNIQUE(tree_id) to UNIQUE(tree_id, provider)
  // Check if the old unique index on tree_id alone exists
  const indexes = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='research_results'`
  ).all() as Array<{ name: string }>;
  const oldIndex = indexes.find(idx => {
    const info = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{ name: string }>;
    return info.length === 1 && info[0].name === 'tree_id';
  });
  if (oldIndex) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS research_results_new (
        id TEXT PRIMARY KEY,
        tree_id TEXT NOT NULL REFERENCES trees(id),
        provider TEXT NOT NULL CHECK(provider IN ('claude', 'chatgpt', 'gemini')),
        findings_json TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tree_id, provider),
        FOREIGN KEY (tree_id) REFERENCES trees(id)
      );
      INSERT OR IGNORE INTO research_results_new SELECT * FROM research_results;
      DROP TABLE research_results;
      ALTER TABLE research_results_new RENAME TO research_results;
    `);
  }

  // Insert default settings row if not present
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('default_provider', 'claude')`).run();
}

function applySchema(db: Database.Database): void {
  db.exec(SCHEMA);
  applyMigrations(db);
}

export interface DatabaseOptions {
  inMemory?: boolean;
  filePath?: string;
}

export function createDatabase(options: DatabaseOptions = {}): Database.Database {
  const defaultPath = process.env.DATA_DIR
    ? `${process.env.DATA_DIR}/client-intelligence.db`
    : 'data/client-intelligence.db';
  const dbPath = options.inMemory ? ':memory:' : (options.filePath ?? defaultPath);

  const db = new Database(dbPath);

  if (!options.inMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  applySchema(db);

  return db;
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
