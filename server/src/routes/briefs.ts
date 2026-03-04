import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type Database from 'better-sqlite3';
import { BriefService } from '../services/briefService.js';
import { DocumentProcessor } from '../services/documentProcessor.js';
import { AppError } from '../errors.js';
import type { SupportedFileType } from '../types.js';

const SUPPORTED_BRIEF_EXTENSIONS = ['pdf', 'docx', 'txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function createBriefRoutes(db: Database.Database): Router {
  const router = Router();
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

  // GET / — List all briefs
  router.get('/', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const briefs = briefService.listBriefs();
      res.json(briefs);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — Get brief detail
  router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const brief = briefService.getBrief(req.params.id as string);
      res.json(brief);
    } catch (err) {
      next(err);
    }
  });

  // POST / — Create a new brief
  router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'No file provided');
      }

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() as SupportedFileType;
      const name = req.body.name || req.file.originalname;

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

      const brief = briefService.createBrief(name, ext, text);
      res.status(201).json(brief);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id — Update an existing brief
  router.put('/:id', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'No file provided');
      }

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() as SupportedFileType;

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

      const brief = briefService.updateBrief(req.params.id as string, ext, text);
      res.json(brief);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — Delete a brief
  router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      briefService.deleteBrief(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
