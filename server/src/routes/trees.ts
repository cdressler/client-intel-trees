import { Router, Request, Response, NextFunction } from 'express';
import { TreeService } from '../services/treeService.js';
import { AppError } from '../errors.js';
import type Database from 'better-sqlite3';

export function createTreeRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new TreeService(db);

  router.get('/', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const trees = service.listTrees();
      res.json(trees);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientName, treeType } = req.body;
      if (clientName === undefined || clientName === null) {
        throw new AppError('VALIDATION_ERROR', 'clientName is required');
      }
      if (!treeType) {
        throw new AppError('VALIDATION_ERROR', 'treeType is required');
      }
      if (treeType !== 'client' && treeType !== 'subject') {
        throw new AppError('VALIDATION_ERROR', `Invalid treeType: ${treeType}. Must be 'client' or 'subject'`);
      }
      const tree = service.createTree(String(clientName), treeType);
      res.status(201).json(tree);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:treeId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const tree = service.getTree(req.params.treeId as string);
      res.json(tree);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
