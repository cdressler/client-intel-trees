import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { AIProvider, ResearchResult, ResearchFinding, ProviderResearchResult, MultiProviderResearchResponse } from '../types.js';
import { AppError } from '../errors.js';
import { getProviderClient } from './providerFactory.js';

const REQUIRED_CATEGORIES = ['financial_performance', 'recent_news', 'new_offerings', 'challenges'];
const INSUFFICIENT_THRESHOLD = 2;

export class ResearchEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async runResearch(treeId: string, clientName: string, provider: AIProvider, briefText?: string): Promise<ResearchResult> {
    // Verify tree exists
    const tree = this.db
      .prepare('SELECT id FROM trees WHERE id = ?')
      .get(treeId) as { id: string } | undefined;

    if (!tree) {
      throw new AppError('NOT_FOUND', `Tree not found: ${treeId}`);
    }

    const client = getProviderClient(provider);
    const result = await client.researchClient(clientName, briefText);

    // Detect insufficient results
    if (!result.findings || result.findings.length < INSUFFICIENT_THRESHOLD) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Insufficient research results for "${clientName}". Please verify the client name is correct and try again.`
      );
    }

    const id = uuidv4();
    const findingsJson = JSON.stringify(result.findings);

    // UPSERT: replace previous research for this tree+provider combination
    this.db
      .prepare(`
        INSERT INTO research_results (id, tree_id, provider, findings_json, completed_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(tree_id, provider) DO UPDATE SET
          id = excluded.id,
          findings_json = excluded.findings_json,
          completed_at = datetime('now')
      `)
      .run(id, treeId, provider, findingsJson);

    // Update trees.last_provider and updated_at (new research makes existing trees outdated)
    this.db
      .prepare("UPDATE trees SET last_provider = ?, updated_at = datetime('now') WHERE id = ?")
      .run(provider, treeId);

    return this.getResearchByProvider(treeId, provider)!;
  }

  getAllResearch(treeId: string): MultiProviderResearchResponse | null {
    const tree = this.db
      .prepare('SELECT client_name FROM trees WHERE id = ?')
      .get(treeId) as { client_name: string } | undefined;

    const rows = this.db
      .prepare('SELECT id, tree_id, provider, findings_json, completed_at FROM research_results WHERE tree_id = ? ORDER BY completed_at DESC')
      .all(treeId) as Array<{
        id: string;
        tree_id: string;
        provider: string;
        findings_json: string;
        completed_at: string;
      }>;

    if (rows.length === 0) return null;

    const clientName = tree?.client_name ?? '';
    const results = Object.fromEntries(
      rows.map(row => {
        const provider = row.provider as AIProvider;
        const findings: ResearchFinding[] = JSON.parse(row.findings_json);
        return [provider, {
          provider,
          findings: { clientName, findings },
        } as ProviderResearchResult];
      })
    ) as Record<AIProvider, ProviderResearchResult>;

    return { results };
  }

  getResearch(treeId: string): ResearchResult | null {
    // Return the most recently completed research for this tree (any provider)
    const row = this.db
      .prepare('SELECT id, tree_id, provider, findings_json, completed_at FROM research_results WHERE tree_id = ? ORDER BY completed_at DESC LIMIT 1')
      .get(treeId) as {
        id: string;
        tree_id: string;
        provider: string;
        findings_json: string;
        completed_at: string;
      } | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      treeId: row.tree_id,
      provider: row.provider as AIProvider,
      findings: JSON.parse(row.findings_json) as ResearchFinding[],
      completedAt: row.completed_at,
    };
  }

  getResearchByProvider(treeId: string, provider: AIProvider): ResearchResult | null {
    const row = this.db
      .prepare('SELECT id, tree_id, provider, findings_json, completed_at FROM research_results WHERE tree_id = ? AND provider = ?')
      .get(treeId, provider) as {
        id: string;
        tree_id: string;
        provider: string;
        findings_json: string;
        completed_at: string;
      } | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      treeId: row.tree_id,
      provider: row.provider as AIProvider,
      findings: JSON.parse(row.findings_json) as ResearchFinding[],
      completedAt: row.completed_at,
    };
  }

  getResearchedProviders(treeId: string): AIProvider[] {
    const rows = this.db
      .prepare('SELECT provider FROM research_results WHERE tree_id = ? ORDER BY completed_at DESC')
      .all(treeId) as Array<{ provider: string }>;
    return rows.map(r => r.provider as AIProvider);
  }

  async runMultiProviderResearch(
    treeId: string,
    name: string,
    providers: AIProvider[],
    briefText?: string
  ): Promise<MultiProviderResearchResponse> {
    const entries = await Promise.allSettled(
      providers.map(p => this.runResearch(treeId, name, p, briefText))
    );

    const results = Object.fromEntries(
      providers.map((p, i) => {
        const settled = entries[i];
        if (settled.status === 'fulfilled') {
          return [p, {
            provider: p,
            findings: { clientName: name, findings: settled.value.findings },
          } as ProviderResearchResult];
        } else {
          return [p, {
            provider: p,
            error: (settled.reason as Error)?.message ?? 'Unknown error',
          } as ProviderResearchResult];
        }
      })
    ) as Record<AIProvider, ProviderResearchResult>;

    return { results };
  }
}
