import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import type Database from 'better-sqlite3';
import { DocumentProcessor } from '../services/documentProcessor.js';
import { AppError } from '../errors.js';
import type { DocumentCategory } from '../types.js';

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function createDocumentRoutes(db: Database.Database, uploadsDir?: string): Router {
  const router = Router({ mergeParams: true });
  const processor = new DocumentProcessor(db, uploadsDir);

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        cb(new AppError(
          'VALIDATION_ERROR',
          `Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
        ));
        return;
      }
      cb(null, true);
    },
  });

  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const treeId = req.params.treeId as string;
      const docs = processor.listDocuments(treeId);
      res.json(docs);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'No file provided');
      }

      const metadata: { projectName?: string; category?: DocumentCategory } = {};
      if (req.body.projectName) metadata.projectName = req.body.projectName;
      if (req.body.category) metadata.category = req.body.category as DocumentCategory;

      const treeId = req.params.treeId as string;
      const doc = await processor.uploadDocument(
        treeId,
        {
          originalname: req.file.originalname,
          path: req.file.path,
          mimetype: req.file.mimetype,
        },
        metadata
      );

      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
