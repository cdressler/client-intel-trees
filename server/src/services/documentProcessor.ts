import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import { AppError } from '../errors.js';
import type { Document, DocumentMetadata, SupportedFileType, DocumentCategory } from '../types.js';

const SUPPORTED_FILE_TYPES: SupportedFileType[] = ['pdf', 'docx', 'pptx', 'xlsx', 'txt'];
const VALID_CATEGORIES: DocumentCategory[] = ['brief', 'schedule', 'deliverable', 'case_study', 'other'];

export class DocumentProcessor {
  private db: Database.Database;
  private uploadsDir: string;

  constructor(db: Database.Database, uploadsDir: string = 'uploads') {
    this.db = db;
    this.uploadsDir = uploadsDir;
  }

  async extractText(filePath: string, fileType: SupportedFileType): Promise<string> {
    if (!SUPPORTED_FILE_TYPES.includes(fileType)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unsupported file type: ${fileType}. Supported formats: ${SUPPORTED_FILE_TYPES.join(', ')}`
      );
    }

    try {
      switch (fileType) {
        case 'pdf':
          return await this.extractPdf(filePath);
        case 'docx':
          return await this.extractDocx(filePath);
        case 'pptx':
          return await this.extractPptx(filePath);
        case 'xlsx':
          return await this.extractXlsx(filePath);
        case 'txt':
          return await this.extractTxt(filePath);
        default:
          throw new Error(`Unhandled file type: ${fileType}`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        'EXTRACTION_FAILED',
        `Failed to extract text from file. Please try re-uploading in a supported format (${SUPPORTED_FILE_TYPES.join(', ')}).`
      );
    }
  }

  async extractTextFromBuffer(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
    const briefTypes: SupportedFileType[] = ['pdf', 'docx', 'txt'];
    if (!briefTypes.includes(fileType)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unsupported file type for brief: ${fileType}. Supported formats: ${briefTypes.join(', ')}`
      );
    }

    try {
      switch (fileType) {
        case 'pdf': {
          const pdfParse = (await import('pdf-parse')).default;
          const data = await pdfParse(buffer);
          return data.text;
        }
        case 'docx': {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          return result.value;
        }
        case 'txt':
          return buffer.toString('utf-8');
        default:
          throw new Error(`Unhandled file type: ${fileType}`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        'EXTRACTION_FAILED',
        `Failed to extract text from buffer. Please try re-uploading in a supported format (pdf, docx, txt).`
      );
    }
  }

  private async extractPdf(filePath: string): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  private async extractDocx(filePath: string): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async extractPptx(filePath: string): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const texts: string[] = [];

    // PPTX slides are stored as ppt/slides/slide{N}.xml
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort();

    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('text');
      // Extract text content from XML tags — strip all XML tags
      const textContent = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (textContent) texts.push(textContent);
    }

    return texts.join('\n\n');
  }

  private async extractXlsx(filePath: string): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const texts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        texts.push(`Sheet: ${sheetName}\n${csv}`);
      }
    }

    return texts.join('\n\n');
  }

  private async extractTxt(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }

  async uploadDocument(
    treeId: string,
    file: { originalname: string; path: string; mimetype: string },
    metadata: DocumentMetadata
  ): Promise<Document> {
    // Verify tree exists
    const tree = this.db
      .prepare('SELECT id FROM trees WHERE id = ?')
      .get(treeId) as { id: string } | undefined;

    if (!tree) {
      throw new AppError('NOT_FOUND', `Tree not found: ${treeId}`);
    }

    // Determine and validate file type
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') as SupportedFileType;
    if (!SUPPORTED_FILE_TYPES.includes(ext)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unsupported file type: .${ext}. Supported formats: ${SUPPORTED_FILE_TYPES.join(', ')}`
      );
    }

    // Validate category if provided
    if (metadata.category && !VALID_CATEGORIES.includes(metadata.category)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Invalid category: ${metadata.category}. Valid categories: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    // Ensure upload directory exists
    const treeUploadDir = path.join(this.uploadsDir, treeId);
    fs.mkdirSync(treeUploadDir, { recursive: true });

    // Move file to permanent location
    const docId = uuidv4();
    const destFileName = `${docId}-${file.originalname}`;
    const destPath = path.join(treeUploadDir, destFileName);
    fs.copyFileSync(file.path, destPath);

    // Extract text
    let extractedText: string | null = null;
    try {
      extractedText = await this.extractText(destPath, ext);
    } catch (err) {
      if (err instanceof AppError && err.code === 'EXTRACTION_FAILED') {
        // Store the document anyway but with null extracted text
        extractedText = null;
      } else {
        throw err;
      }
    }

    // Insert into database
    this.db
      .prepare(
        `INSERT INTO documents (id, tree_id, file_name, file_path, file_type, project_name, category, extracted_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        docId,
        treeId,
        file.originalname,
        destPath,
        ext,
        metadata.projectName ?? null,
        metadata.category ?? null,
        extractedText
      );

    // If tree has a current decision tree, mark it as outdated by updating updated_at
    this.db
      .prepare(
        `UPDATE trees SET updated_at = datetime('now')
         WHERE id = ? AND EXISTS (SELECT 1 FROM decision_trees WHERE tree_id = ? AND is_current = 1)`
      )
      .run(treeId, treeId);

    return this.getDocument(docId);
  }

  listDocuments(treeId: string): Document[] {
    const rows = this.db
      .prepare(
        `SELECT id, tree_id, file_name, file_path, file_type, project_name, category, extracted_text, uploaded_at
         FROM documents WHERE tree_id = ? ORDER BY uploaded_at DESC`
      )
      .all(treeId) as Array<{
        id: string;
        tree_id: string;
        file_name: string;
        file_path: string;
        file_type: string;
        project_name: string | null;
        category: string | null;
        extracted_text: string | null;
        uploaded_at: string;
      }>;

    return rows.map((row) => ({
      id: row.id,
      treeId: row.tree_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as SupportedFileType,
      projectName: row.project_name,
      category: row.category as DocumentCategory | null,
      extractedText: row.extracted_text,
      uploadedAt: row.uploaded_at,
    }));
  }

  private getDocument(docId: string): Document {
    const row = this.db
      .prepare(
        `SELECT id, tree_id, file_name, file_path, file_type, project_name, category, extracted_text, uploaded_at
         FROM documents WHERE id = ?`
      )
      .get(docId) as {
        id: string;
        tree_id: string;
        file_name: string;
        file_path: string;
        file_type: string;
        project_name: string | null;
        category: string | null;
        extracted_text: string | null;
        uploaded_at: string;
      } | undefined;

    if (!row) {
      throw new AppError('NOT_FOUND', `Document not found: ${docId}`);
    }

    return {
      id: row.id,
      treeId: row.tree_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as SupportedFileType,
      projectName: row.project_name,
      category: row.category as DocumentCategory | null,
      extractedText: row.extracted_text,
      uploadedAt: row.uploaded_at,
    };
  }
}
