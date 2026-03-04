import { Router, Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import { TreeGenerator } from '../services/treeGenerator.js';
import { TreeService } from '../services/treeService.js';
import { AppError } from '../errors.js';
import type { AIProvider } from '../types.js';

const VALID_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

export function createDecisionTreeRoutes(db: Database.Database): Router {
  const router = Router({ mergeParams: true });
  const generator = new TreeGenerator(db);
  const treeService = new TreeService(db);

  // GET /api/trees/:treeId/decision-tree — get all current decision trees (one per provider)
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;
      treeService.getTree(treeId); // verify tree exists

      const trees = generator.getAllCurrentTrees(treeId);
      if (trees.length === 0) {
        res.json(null);
      } else if (trees.length === 1) {
        // Single tree — return as before for backward compatibility
        res.json(trees[0]);
      } else {
        // Multiple per-provider trees — return as array
        res.json(trees);
      }
    } catch (err) {
      next(err);
    }
  });

  // POST /api/trees/:treeId/decision-tree — generate decision tree
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;
      const provider: AIProvider = req.body.provider || 'claude';

      if (!VALID_PROVIDERS.includes(provider)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Invalid provider "${provider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`
        );
      }

      const result = await generator.generateTree(treeId, provider);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/trees/:treeId/decision-tree/previous — get previous decision tree
  router.get('/previous', (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;
      treeService.getTree(treeId); // verify tree exists

      const tree = generator.getPreviousTree(treeId);
      res.json(tree);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
