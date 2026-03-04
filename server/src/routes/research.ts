import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type Database from 'better-sqlite3';
import { ResearchEngine } from '../services/researchEngine.js';
import { TreeService } from '../services/treeService.js';
import { BriefService } from '../services/briefService.js';
import { DocumentProcessor } from '../services/documentProcessor.js';
import { AppError } from '../errors.js';
import type { AIProvider, SupportedFileType } from '../types.js';

const VALID_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];
const SUPPORTED_BRIEF_EXTENSIONS = ['pdf', 'docx', 'txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function createResearchRoutes(db: Database.Database): Router {
  const router = Router({ mergeParams: true });
  const engine = new ResearchEngine(db);
  const treeService = new TreeService(db);
  const briefService = new BriefService(db);
  const docProcessor = new DocumentProcessor(db);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_BRIEF_EXTENSIONS.includes(ext)) {
        cb(new AppError(
          'VALIDATION_ERROR',
          `Unsupported file type. Supported formats: ${SUPPORTED_BRIEF_EXTENSIONS.join(', ')}`
        ));
        return;
      }
      cb(null, true);
    },
  });

  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;
      treeService.getTree(treeId);
      const result = engine.getAllResearch(treeId);
      if (!result) {
        res.json(null);
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST handler that supports both multipart/form-data and application/json
  router.post('/', upload.single('briefFile'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;

      // Parse providers from either multipart field (JSON string) or JSON body (array)
      let providers: AIProvider[];
      const rawProviders = req.body.providers;
      if (typeof rawProviders === 'string') {
        try {
          providers = JSON.parse(rawProviders);
        } catch {
          throw new AppError('VALIDATION_ERROR', 'Invalid providers format. Must be a JSON array.');
        }
      } else if (Array.isArray(rawProviders)) {
        providers = rawProviders;
      } else {
        throw new AppError('VALIDATION_ERROR', 'providers is required and must be a non-empty array of valid provider values.');
      }

      // Validate providers is a non-empty array of valid values
      if (!Array.isArray(providers) || providers.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'providers is required and must be a non-empty array of valid provider values.');
      }

      for (const p of providers) {
        if (!VALID_PROVIDERS.includes(p)) {
          throw new AppError(
            'VALIDATION_ERROR',
            `Invalid provider "${p}". Must be one of: ${VALID_PROVIDERS.join(', ')}`
          );
        }
      }

      const tree = treeService.getTree(treeId);
      let briefText: string | undefined;

      // Handle brief file upload
      if (req.file) {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase() as SupportedFileType;
        const briefName = req.body.briefName || req.file.originalname;

        let text: string;
        try {
          text = await docProcessor.extractTextFromBuffer(req.file.buffer, ext);
        } catch (err) {
          if (err instanceof AppError && err.code === 'EXTRACTION_FAILED') {
            res.status(422).json({
              error: { code: 'EXTRACTION_FAILED', message: err.message },
            });
            return;
          }
          throw err;
        }

        // Save to Brief_Library
        briefService.createBrief(briefName, ext, text);
        briefText = text;
      }
      // Handle brief selection from library
      else if (req.body.briefId) {
        const brief = briefService.getBrief(req.body.briefId);
        briefText = brief.text;
      }

      const result = await engine.runMultiProviderResearch(treeId, tree.clientName, providers, briefText);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
