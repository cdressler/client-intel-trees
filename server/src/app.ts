import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type Database from 'better-sqlite3';
import { AppError, AIProviderError } from './errors.js';
import { createTreeRoutes } from './routes/trees.js';
import { createDocumentRoutes } from './routes/documents.js';
import { createResearchRoutes } from './routes/research.js';
import { createDecisionTreeRoutes } from './routes/decisionTree.js';
import { createBriefRoutes } from './routes/briefs.js';
import { createSettingsRoutes } from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(db: Database.Database, uploadsDir?: string): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Basic auth protection (set SITE_USER and SITE_PASSWORD env vars to enable)
  const siteUser = process.env.SITE_USER;
  const sitePassword = process.env.SITE_PASSWORD;
  if (siteUser && sitePassword) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization;
      if (auth) {
        const [scheme, encoded] = auth.split(' ');
        if (scheme === 'Basic' && encoded) {
          const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
          const [user, pass] = decoded.split(':');
          if (user === siteUser && pass === sitePassword) {
            next();
            return;
          }
        }
      }
      res.set('WWW-Authenticate', 'Basic realm="Client Intelligence Tree"');
      res.status(401).send('Authentication required');
    });
  }

  // Mount API routes
  app.use('/api/trees', createTreeRoutes(db));
  app.use('/api/trees/:treeId/documents', createDocumentRoutes(db, uploadsDir));
  app.use('/api/trees/:treeId/research', createResearchRoutes(db));
  app.use('/api/trees/:treeId/decision-tree', createDecisionTreeRoutes(db));
  app.use('/api/briefs', createBriefRoutes(db));
  app.use('/api/settings', createSettingsRoutes(db));

  // Serve static frontend in production
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AIProviderError) {
      const httpStatus = err.statusCode >= 500 ? 502 : err.statusCode === 429 ? 503 : 502;
      res.status(httpStatus).json({
        error: {
          code: httpStatus === 503 ? 'AI_PROVIDER_UNAVAILABLE' : 'AI_PROVIDER_ERROR',
          message: err.message,
          provider: err.provider,
        },
      });
      return;
    }

    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    // Multer file size error
    if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File size exceeds the 10MB limit',
        },
      });
      return;
    }

    console.error('Unhandled error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}
