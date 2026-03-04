import { Router, Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import { SettingsService } from '../services/settingsService.js';
import { AppError } from '../errors.js';
import type { AIProvider } from '../types.js';

const VALID_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];
const DEFAULT_PROVIDER: AIProvider = 'claude';

export function createSettingsRoutes(db: Database.Database): Router {
  const router = Router();
  const settingsService = new SettingsService(db);

  // GET /default-provider
  router.get('/default-provider', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const value = settingsService.getSetting('default_provider');
      const provider = (value ?? DEFAULT_PROVIDER) as AIProvider;
      res.json({ provider });
    } catch (err) {
      next(err);
    }
  });

  // PUT /default-provider
  router.put('/default-provider', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.body;

      if (!provider || !VALID_PROVIDERS.includes(provider)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`
        );
      }

      settingsService.setSetting('default_provider', provider);
      res.json({ provider });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
