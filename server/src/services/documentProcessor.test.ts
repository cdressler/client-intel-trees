import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { TreeService } from './treeService.js';
import { DocumentProcessor } from './documentProcessor.js';
import { AppError } from '../errors.js';
import type { SupportedFileType, DocumentCategory } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED_TYPES: SupportedFileType[] = ['pdf', 'docx', 'pptx', 'xlsx', 'txt'];
const VALID_CATEGORIES: DocumentCategory[] = ['brief', 'schedule', 'deliverable', 'other'];

function createTestFile(dir: string, fileName: string): string {
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, `Test content for ${fileName}`);
  return filePath;
}

describe('DocumentProcessor property tests', () => {
  let db: Database.Database;
  let treeService: TreeService;
  let processor: DocumentProcessor;
  let tmpDir: string;
  let uploadsDir: string;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    treeService = new TreeService(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docproc-test-'));
    uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    processor = new DocumentProcessor(db, uploadsDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Feature: client-intelligence-tree, Property 4: Supported file types are accepted
  it('Property 4: uploading files of each supported type succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...SUPPORTED_TYPES),
        fc.integer({ min: 1, max: 9999 }),
        async (fileType, n) => {
          const fileName = `testfile-${n}.${fileType}`;
          const filePath = createTestFile(tmpDir, fileName);

          const tree = treeService.createTree(`Client-${n}`, 'client');
          const doc = await processor.uploadDocument(
            tree.id,
            { originalname: fileName, path: filePath, mimetype: 'application/octet-stream' },
            {}
          );

          expect(doc.id).toBeTruthy();
          expect(doc.treeId).toBe(tree.id);
          expect(doc.fileName).toBe(fileName);
          expect(doc.fileType).toBe(fileType);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 5: Document upload preserves metadata and extracts text
  it('Property 5: uploaded document preserves metadata and extracts text for txt files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 9999 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.constantFrom(...VALID_CATEGORIES),
        async (n, projectName, category) => {
          const fileName = `doc-${n}.txt`;
          const filePath = createTestFile(tmpDir, fileName);

          const tree = treeService.createTree(`Client-${n}`, 'client');
          const doc = await processor.uploadDocument(
            tree.id,
            { originalname: fileName, path: filePath, mimetype: 'text/plain' },
            { projectName, category }
          );

          expect(doc.fileName).toBe(fileName);
          expect(doc.fileType).toBe('txt');
          expect(doc.projectName).toBe(projectName);
          expect(doc.category).toBe(category);
          expect(doc.extractedText).toBeTruthy();
          expect(doc.extractedText!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 6: Document list completeness
  it('Property 6: listDocuments returns all uploaded documents with required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (count) => {
          const tree = treeService.createTree(`Client-list-${Date.now()}`, 'client');
          const uploadedIds: string[] = [];

          for (let i = 0; i < count; i++) {
            const fileName = `doc-${Date.now()}-${i}.txt`;
            const filePath = createTestFile(tmpDir, fileName);
            const doc = await processor.uploadDocument(
              tree.id,
              { originalname: fileName, path: filePath, mimetype: 'text/plain' },
              {}
            );
            uploadedIds.push(doc.id);
          }

          const listed = processor.listDocuments(tree.id);
          expect(listed.length).toBe(count);

          for (const doc of listed) {
            expect(uploadedIds).toContain(doc.id);
            expect(doc.fileName).toBeTruthy();
            expect(doc.uploadedAt).toBeTruthy();
            expect(doc.fileType).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: client-intelligence-tree, Property 7: Unsupported file type rejection
  it('Property 7: uploading unsupported file types is rejected with supported formats in error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 1, maxLength: 8 })
          .filter((s) => !SUPPORTED_TYPES.includes(s as any)),
        async (ext) => {
          const tree = treeService.createTree(`Client-unsupported-${Date.now()}`, 'client');
          const fileName = `file.${ext}`;
          const filePath = path.join(tmpDir, fileName);
          fs.writeFileSync(filePath, 'test content');

          try {
            await processor.uploadDocument(
              tree.id,
              { originalname: fileName, path: filePath, mimetype: 'application/octet-stream' },
              {}
            );
            expect.unreachable('Should have thrown');
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.code).toBe('VALIDATION_ERROR');
            for (const supported of SUPPORTED_TYPES) {
              expect(appErr.message).toContain(supported);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('DocumentProcessor.extractTextFromBuffer', () => {
  let db: Database.Database;
  let processor: DocumentProcessor;
  let tmpDir: string;
  let uploadsDir: string;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docproc-buf-test-'));
    uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    processor = new DocumentProcessor(db, uploadsDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns non-empty string for a TXT buffer', async () => {
    const buffer = Buffer.from('Hello, this is a test brief.', 'utf-8');
    const result = await processor.extractTextFromBuffer(buffer, 'txt');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Hello');
  });

  it('returns a string for a minimal valid PDF buffer', async () => {
    // Use a real PDF fixture file (generated by cupsfilter)
    const fixturePath = path.join(__dirname, '__fixtures__', 'hello.pdf');
    const buffer = fs.readFileSync(fixturePath);
    const result = await processor.extractTextFromBuffer(buffer, 'pdf');
    expect(typeof result).toBe('string');
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it('returns non-empty string for a minimal valid DOCX buffer', async () => {
    // Build a minimal DOCX (ZIP with word/document.xml)
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Brief content here</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', docXml);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const buffer = Buffer.from(arrayBuffer);
    const result = await processor.extractTextFromBuffer(buffer, 'docx');
    expect(result).toBeTruthy();
    expect(result).toContain('Brief content here');
  });

  it('throws VALIDATION_ERROR for unsupported file type', async () => {
    const buffer = Buffer.from('some content');
    await expect(processor.extractTextFromBuffer(buffer, 'pptx' as any)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('DocumentProcessor.uploadDocument with case_study category', () => {
  let db: Database.Database;
  let treeService: TreeService;
  let processor: DocumentProcessor;
  let tmpDir: string;
  let uploadsDir: string;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    treeService = new TreeService(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docproc-cat-test-'));
    uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    processor = new DocumentProcessor(db, uploadsDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts case_study as a valid category', async () => {
    const tree = treeService.createTree('Test Client', 'client');
    const fileName = 'test.txt';
    const filePath = path.join(tmpDir, fileName);
    fs.writeFileSync(filePath, 'Case study content');

    const doc = await processor.uploadDocument(
      tree.id,
      { originalname: fileName, path: filePath, mimetype: 'text/plain' },
      { category: 'case_study' }
    );

    expect(doc.category).toBe('case_study');
  });
});

/**
 * Property 9: extractTextFromBuffer succeeds for all supported brief formats
 * For any valid buffer of type pdf, docx, or txt, extractTextFromBuffer should
 * return a non-empty string without throwing.
 * Validates: Requirements 2.5
 */
describe('Property 9: extractTextFromBuffer succeeds for all supported brief formats', () => {
  let db: Database.Database;
  let processor: DocumentProcessor;
  let tmpDir: string;
  let uploadsDir: string;
  let pdfFixtureBuffer: Buffer;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docproc-prop9-'));
    uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    processor = new DocumentProcessor(db, uploadsDir);
    pdfFixtureBuffer = fs.readFileSync(path.join(__dirname, '__fixtures__', 'hello.pdf'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Property 9: extractTextFromBuffer returns non-empty string for txt buffers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0),
        async (content) => {
          const buffer = Buffer.from(content, 'utf-8');
          const result = await processor.extractTextFromBuffer(buffer, 'txt');
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: extractTextFromBuffer returns non-empty string for docx buffers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0 && !s.includes('<') && !s.includes('>')),
        async (content) => {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${content}</w:t></w:r></w:p></w:body>
</w:document>`;
          zip.file('word/document.xml', docXml);
          zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
          zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
          const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
          const buffer = Buffer.from(arrayBuffer);
          const result = await processor.extractTextFromBuffer(buffer, 'docx');
          expect(typeof result).toBe('string');
          expect(result.trim().length).toBeGreaterThan(0);
          expect(result).toContain(content.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: extractTextFromBuffer returns non-empty string for pdf buffers', async () => {
    // For PDF, we use the real fixture buffer (pdf-parse requires a valid PDF structure)
    // The property verifies the method handles the pdf type correctly across multiple calls
    await fc.assert(
      fc.asyncProperty(
        fc.constant(pdfFixtureBuffer),
        async (buffer) => {
          const result = await processor.extractTextFromBuffer(buffer, 'pdf');
          expect(typeof result).toBe('string');
          expect(result.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
