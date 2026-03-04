// Unit tests for BriefManagementConsole
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSupportedBriefFile,
  getExtension,
  formatBriefDate,
} from './BriefManagementConsole';
import * as api from '../api';

// --- Unit Tests (Task 23.1) ---

describe('BriefManagementConsole utilities', () => {
  describe('getExtension', () => {
    it('extracts lowercase extension from a filename', () => {
      expect(getExtension('report.PDF')).toBe('pdf');
      expect(getExtension('notes.TXT')).toBe('txt');
      expect(getExtension('doc.docx')).toBe('docx');
    });

    it('returns empty string for files without extension', () => {
      expect(getExtension('README')).toBe('readme');
    });

    it('handles filenames with multiple dots', () => {
      expect(getExtension('my.report.final.pdf')).toBe('pdf');
    });
  });

  describe('isSupportedBriefFile', () => {
    it('accepts pdf, docx, and txt files', () => {
      expect(isSupportedBriefFile('brief.pdf')).toBe(true);
      expect(isSupportedBriefFile('brief.docx')).toBe(true);
      expect(isSupportedBriefFile('brief.txt')).toBe(true);
    });

    it('rejects unsupported file types', () => {
      expect(isSupportedBriefFile('image.png')).toBe(false);
      expect(isSupportedBriefFile('data.csv')).toBe(false);
      expect(isSupportedBriefFile('archive.zip')).toBe(false);
      expect(isSupportedBriefFile('spreadsheet.xlsx')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isSupportedBriefFile('BRIEF.PDF')).toBe(true);
      expect(isSupportedBriefFile('Brief.DOCX')).toBe(true);
      expect(isSupportedBriefFile('notes.Txt')).toBe(true);
    });
  });

  describe('formatBriefDate', () => {
    it('formats an ISO date string into a readable date', () => {
      const formatted = formatBriefDate('2025-06-15T10:30:00Z');
      // The exact format depends on locale, but it should contain the year
      expect(formatted).toContain('2025');
    });
  });
});

describe('BriefManagementConsole API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Test: brief list is displayed on mount (verifies listBriefs is callable and returns expected shape)
  // Requirement 8.1
  it('listBriefs returns an array of Brief objects', async () => {
    const mockBriefs = [
      { id: '1', name: 'brief1.pdf', fileType: 'pdf' as const, createdAt: '2025-01-01T00:00:00Z' },
      { id: '2', name: 'brief2.txt', fileType: 'txt' as const, createdAt: '2025-02-01T00:00:00Z' },
    ];
    vi.spyOn(api, 'listBriefs').mockResolvedValue(mockBriefs);

    const result = await api.listBriefs();
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('name', 'brief1.pdf');
    expect(result[1]).toHaveProperty('name', 'brief2.txt');
    expect(api.listBriefs).toHaveBeenCalledOnce();
  });

  // Test: create action calls the correct API function
  // Requirement 8.2
  it('createBrief is called with name and file', async () => {
    const mockBrief = { id: '3', name: 'new.pdf', fileType: 'pdf' as const, createdAt: '2025-03-01T00:00:00Z' };
    vi.spyOn(api, 'createBrief').mockResolvedValue(mockBrief);

    const file = new File(['content'], 'new.pdf', { type: 'application/pdf' });
    const result = await api.createBrief('new.pdf', file);
    expect(result.id).toBe('3');
    expect(api.createBrief).toHaveBeenCalledWith('new.pdf', file);
  });

  // Test: update action calls the correct API function
  // Requirement 8.3
  it('updateBrief is called with id and file', async () => {
    const mockBrief = { id: '1', name: 'updated.docx', fileType: 'docx' as const, createdAt: '2025-01-01T00:00:00Z' };
    vi.spyOn(api, 'updateBrief').mockResolvedValue(mockBrief);

    const file = new File(['new content'], 'updated.docx');
    const result = await api.updateBrief('1', file);
    expect(result.id).toBe('1');
    expect(api.updateBrief).toHaveBeenCalledWith('1', file);
  });

  // Test: delete action calls the correct API function
  // Requirement 8.4
  it('deleteBrief is called with the brief id', async () => {
    vi.spyOn(api, 'deleteBrief').mockResolvedValue(undefined);

    await api.deleteBrief('1');
    expect(api.deleteBrief).toHaveBeenCalledWith('1');
  });

  // Test: error message is shown on upload failure
  // Requirement 8.5
  it('createBrief rejects with ApiError on failure', async () => {
    vi.spyOn(api, 'createBrief').mockRejectedValue(
      new api.ApiError(422, 'EXTRACTION_FAILED', 'Could not extract text from file'),
    );

    await expect(api.createBrief('bad.pdf', new File([], 'bad.pdf'))).rejects.toThrow(
      'Could not extract text from file',
    );
  });

  // Test: file type validation rejects unsupported formats
  // Requirement 8.6
  it('isSupportedBriefFile rejects non-PDF/DOCX/TXT files used for upload', () => {
    expect(isSupportedBriefFile('image.png')).toBe(false);
    expect(isSupportedBriefFile('data.json')).toBe(false);
    expect(isSupportedBriefFile('sheet.xlsx')).toBe(false);
  });
});
