import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type {
  AIProvider,
  DecisionTree,
  RootNode,
  LeafNode,
  DocumentContent,
  DocumentInsights,
  ResearchFinding,
  ResearchFindings,
  RawDecisionTree,
  RawRootNode,
} from '../types.js';
import { AppError } from '../errors.js';
import { getProviderClient } from './providerFactory.js';

export class TreeGenerator {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async generateTree(treeId: string, provider: AIProvider): Promise<DecisionTree> {
    // Verify tree exists
    const tree = this.db
      .prepare('SELECT id, client_name FROM trees WHERE id = ?')
      .get(treeId) as { id: string; client_name: string } | undefined;

    if (!tree) {
      throw new AppError('NOT_FOUND', `Tree not found: ${treeId}`);
    }

    // Validate precondition: at least one document
    const docCount = this.db
      .prepare('SELECT COUNT(*) as count FROM documents WHERE tree_id = ?')
      .get(treeId) as { count: number };

    if (docCount.count === 0) {
      throw new AppError(
        'PRECONDITION_FAILED',
        'At least one document is required before generating a conversation tree.'
      );
    }

    // Validate precondition: research is complete (for this provider or any provider)
    let research = this.db
      .prepare('SELECT id, findings_json FROM research_results WHERE tree_id = ? AND provider = ?')
      .get(treeId, provider) as { id: string; findings_json: string } | undefined;

    // Fall back to any available research if the specific provider hasn't been researched
    if (!research) {
      research = this.db
        .prepare('SELECT id, findings_json FROM research_results WHERE tree_id = ? ORDER BY completed_at DESC LIMIT 1')
        .get(treeId) as { id: string; findings_json: string } | undefined;
    }

    if (!research) {
      throw new AppError(
        'PRECONDITION_FAILED',
        'Client research must be completed before generating a conversation tree.'
      );
    }

    // Gather document content for AI analysis
    const docs = this.db
      .prepare(
        `SELECT id, file_name, extracted_text FROM documents
         WHERE tree_id = ? AND extracted_text IS NOT NULL`
      )
      .all(treeId) as Array<{ id: string; file_name: string; extracted_text: string }>;

    const documentContents: DocumentContent[] = docs.map((d) => ({
      id: d.id,
      fileName: d.file_name,
      extractedText: d.extracted_text,
    }));

    const findings: ResearchFinding[] = JSON.parse(research.findings_json);
    const researchFindings: ResearchFindings = {
      clientName: tree.client_name,
      findings,
    };

    // Resolve provider and call AI
    const client = getProviderClient(provider);
    const insights: DocumentInsights = await client.analyzeDocuments(documentContents);
    const rawTree: RawDecisionTree = await client.generateDecisionTree(insights, researchFindings);

    // Validate AI response structure
    this.validateDecisionTree(rawTree);

    // Mark previous decision tree for this provider as not current
    this.db
      .prepare('UPDATE decision_trees SET is_current = 0 WHERE tree_id = ? AND provider = ? AND is_current = 1')
      .run(treeId, provider);

    // Insert new decision tree
    const treeNodeId = uuidv4();
    const treeJson = JSON.stringify(rawTree);

    this.db
      .prepare(
        `INSERT INTO decision_trees (id, tree_id, provider, tree_json, is_current, generated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`
      )
      .run(treeNodeId, treeId, provider, treeJson);

    // Update trees.last_provider (but NOT updated_at — that should only change on document changes)
    this.db
      .prepare("UPDATE trees SET last_provider = ? WHERE id = ?")
      .run(provider, treeId);

    return this.getCurrentTree(treeId)!;
  }

  getCurrentTree(treeId: string): DecisionTree | null {
    return this.getTreeByCondition(treeId, 'is_current = 1');
  }

  getAllCurrentTrees(treeId: string): DecisionTree[] {
    const rows = this.db
      .prepare(
        `SELECT id, tree_id, provider, tree_json, is_current, generated_at
         FROM decision_trees WHERE tree_id = ? AND is_current = 1
         ORDER BY generated_at DESC`
      )
      .all(treeId) as Array<{
        id: string;
        tree_id: string;
        provider: string;
        tree_json: string;
        is_current: number;
        generated_at: string;
      }>;

    return rows.map(row => {
      const rawTree: RawDecisionTree = JSON.parse(row.tree_json);
      return {
        id: row.id,
        treeId: row.tree_id,
        provider: row.provider as AIProvider,
        rootNodes: rawTree.rootNodes.map((rn) => this.mapRootNode(rn)),
        isCurrent: true,
        generatedAt: row.generated_at,
      };
    });
  }

  getPreviousTree(treeId: string): DecisionTree | null {
    return this.getTreeByCondition(treeId, 'is_current = 0', 'generated_at DESC');
  }

  private getTreeByCondition(
    treeId: string,
    condition: string,
    orderBy: string = 'generated_at DESC'
  ): DecisionTree | null {
    const row = this.db
      .prepare(
        `SELECT id, tree_id, provider, tree_json, is_current, generated_at
         FROM decision_trees WHERE tree_id = ? AND ${condition}
         ORDER BY ${orderBy} LIMIT 1`
      )
      .get(treeId) as {
        id: string;
        tree_id: string;
        provider: string;
        tree_json: string;
        is_current: number;
        generated_at: string;
      } | undefined;

    if (!row) {
      return null;
    }

    const rawTree: RawDecisionTree = JSON.parse(row.tree_json);

    return {
      id: row.id,
      treeId: row.tree_id,
      provider: row.provider as AIProvider,
      rootNodes: rawTree.rootNodes.map((rn) => this.mapRootNode(rn)),
      isCurrent: row.is_current === 1,
      generatedAt: row.generated_at,
    };
  }

  private mapRootNode(raw: RawRootNode): RootNode {
    return {
      id: raw.id,
      title: raw.title,
      content: raw.content,
      rationale: raw.rationale,
      sourceDocumentIds: raw.sourceDocumentIds ?? [],
      sourceResearchCategories: raw.sourceResearchCategories ?? [],
      leafNodes: (raw.leafNodes ?? []).map((ln) => this.mapLeafNode(ln)),
    };
  }

  private mapLeafNode(raw: { id: string; title: string; content: string; rationale: string; sourceDocumentIds: string[]; sourceResearchCategories: string[] }): LeafNode {
    return {
      id: raw.id,
      title: raw.title,
      content: raw.content,
      rationale: raw.rationale,
      sourceDocumentIds: raw.sourceDocumentIds ?? [],
      sourceResearchCategories: raw.sourceResearchCategories ?? [],
    };
  }

  private validateDecisionTree(rawTree: RawDecisionTree): void {
    if (!rawTree.rootNodes || rawTree.rootNodes.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'AI provider returned a decision tree with no root nodes.');
    }

    for (const root of rawTree.rootNodes) {
      this.validateNodeFields(root, 'Root node');

      if (!root.leafNodes || root.leafNodes.length === 0) {
        throw new AppError(
          'INTERNAL_ERROR',
          `AI provider returned root node "${root.title}" with no leaf nodes.`
        );
      }

      for (const leaf of root.leafNodes) {
        this.validateNodeFields(leaf, 'Leaf node');
      }
    }
  }

  private validateNodeFields(
    node: { id?: string; title?: string; content?: string; rationale?: string },
    label: string
  ): void {
    if (!node.title?.trim()) {
      throw new AppError('INTERNAL_ERROR', `${label} has an empty or missing title.`);
    }
    if (!node.content?.trim()) {
      throw new AppError('INTERNAL_ERROR', `${label} "${node.title}" has empty or missing content.`);
    }
    if (!node.rationale?.trim()) {
      throw new AppError('INTERNAL_ERROR', `${label} "${node.title}" has empty or missing rationale.`);
    }
  }
}
