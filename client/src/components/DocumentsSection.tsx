import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import type { Document, DocumentCategory } from '../types';
import { uploadDocument, ApiError } from '../api';
import { useToast } from './Toast';

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'txt'] as const;
const SUPPORTED_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.txt';

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  brief: 'Brief',
  schedule: 'Schedule',
  deliverable: 'Deliverable',
  case_study: 'Case Study',
  other: 'Other',
};

interface Props {
  treeId: string;
  documents: Document[];
  onDocumentsChange: () => void;
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isSupported(fileName: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DocumentsSection({ treeId, documents, onDocumentsChange }: Props) {
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setExtractionError(null);
    if (!isSupported(file.name)) {
      setFileError(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploading(true);
    setExtractionError(null);
    try {
      await uploadDocument(treeId, selectedFile, {
        projectName: projectName.trim() || undefined,
        category: category || undefined,
      });
      setSelectedFile(null);
      setProjectName('');
      setCategory('');
      onDocumentsChange();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXTRACTION_FAILED') {
        setExtractionError('Could not extract text from this file. Please try re-uploading in a supported format.');
      } else {
        showToast(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  }, [selectedFile, treeId, projectName, category, onDocumentsChange, showToast]);

  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setProjectName('');
    setCategory('');
    setFileError(null);
    setExtractionError(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload document — click or drag and drop a file here"
        aria-describedby="dropzone-hint"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100 hover:border-primary/50 hover:bg-base-200'}`}
      >
        <div aria-hidden="true" className="text-4xl mb-2">📄</div>
        <p className="font-medium text-base-content">Click or drag a file here to upload</p>
        <p id="dropzone-hint" className="text-sm text-base-content/50 mt-1">
          Supported: {SUPPORTED_EXTENSIONS.join(', ')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_ACCEPT}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {fileError && (
        <div role="alert" aria-live="assertive" className="alert alert-error text-sm">
          {fileError}
        </div>
      )}

      {selectedFile && (
        <div className="card bg-base-100 shadow">
          <div className="card-body gap-4">
            <p className="font-medium">
              Selected: <span className="font-mono text-primary">{selectedFile.name}</span>
            </p>

            {extractionError && (
              <div role="alert" aria-live="assertive" className="alert alert-error text-sm">
                {extractionError}
              </div>
            )}

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-48">
                <label htmlFor="doc-project-name" className="label">
                  <span className="label-text">Project Name <span className="text-base-content/40">(optional)</span></span>
                </label>
                <input
                  id="doc-project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q4 Campaign"
                  className="input input-bordered w-full"
                />
              </div>

              <div className="flex-1 min-w-40">
                <label htmlFor="doc-category" className="label">
                  <span className="label-text">Category <span className="text-base-content/40">(optional)</span></span>
                </label>
                <select
                  id="doc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory | '')}
                  className="select select-bordered w-full"
                >
                  <option value="">— select —</option>
                  <option value="brief">Brief</option>
                  <option value="schedule">Schedule</option>
                  <option value="deliverable">Deliverable</option>
                  <option value="case_study">Case Study</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading}
                aria-busy={uploading}
              >
                {uploading && <span className="loading loading-spinner loading-sm" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleCancel}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-4xl mb-3">📂</p>
          <p>No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow">
          <table
            className="table table-zebra responsive-table w-full"
            aria-label="Uploaded documents"
          >
            <thead>
              <tr>
                {['File Name', 'Project Name', 'Category', 'File Type', 'Upload Date'].map((col) => (
                  <th key={col} scope="col">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td data-label="File Name" className="font-mono text-sm break-all">{doc.fileName}</td>
                  <td data-label="Project Name">{doc.projectName ?? <span className="text-base-content/30">—</span>}</td>
                  <td data-label="Category">{doc.category ? CATEGORY_LABELS[doc.category] : <span className="text-base-content/30">—</span>}</td>
                  <td data-label="File Type">
                    <span className="badge badge-ghost badge-sm uppercase font-semibold">{doc.fileType}</span>
                  </td>
                  <td data-label="Upload Date" className="whitespace-nowrap text-base-content/60">{formatDate(doc.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
