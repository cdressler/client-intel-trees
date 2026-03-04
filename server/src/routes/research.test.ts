import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { createApp } from '../app.js';
import type express from 'express';
import type { AIProvider, ResearchFinding, AIProviderClient } from '../types.js';

const REQUIRED_CATEGORIES = [
  'financial_performance',
  'recent_news',
  'new_offerings',
  'challenges',
] as const;

function buildFindings(): ResearchFinding[] {
  return REQUIRED_CATEGORIES.map((cat) => ({
    category: cat,
    title: `${cat} title`,
    summary: `${cat} summary`,
    source: `https://example.com/${cat}`,
  }));
}

function makeMockProvider(provider: AIProvider, findings: ResearchFinding[]): AIProviderClient {
  return {
    providerName: provider,
    analyzeDocuments: vi.fn(),
    researchClient: vi.fn().mockResolvedValue({ clientName: 'Test Client', findings }),
    generateDecisionTree: vi.fn(),
  };
}

vi.mock('../services/providerFactory.js', () => ({
  getProviderClient: vi.fn(),
}));

import { getProviderClient } from '../services/providerFactory.js';
const mockedGetProvider = vi.mocked(getProviderClient);

describe('Research Routes - Brief handling and multi-provider validation', () => {
  let db: Database.Database;
  let app: express.Express;
  let treeId: string;

  beforeEach(async () => {
    db = createDatabase({ inMemory: true });
    app = createApp(db);

    // Set up mock provider for all tests
    const findings = buildFindings();
    mockedGetProvider.mockImplementation((provider: AIProvider) => {
      return makeMockProvider(provider, findings);
    });

    // Create a tree to use in research requests
    const treeRes = await request(app)
      .post('/api/trees')
      .send({ clientName: 'Test Client', treeType: 'client' });
    treeId = treeRes.body.id;
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('rejects brief file with unsupported extension with HTTP 400', async () => {
    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .attach('briefFile', Buffer.from('some data'), 'image.png')
      .field('providers', JSON.stringify(['claude']));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Unsupported file type');
  });

  it('returns 422 when text extraction fails', async () => {
    // Create a buffer that will fail PDF parsing (invalid PDF content)
    const invalidPdfBuffer = Buffer.from('this is not a valid pdf');

    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .attach('briefFile', invalidPdfBuffer, 'bad.pdf')
      .field('providers', JSON.stringify(['claude']));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EXTRACTION_FAILED');
  });

  it('returns 404 when briefId does not exist', async () => {
    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .send({ providers: ['claude'], briefId: 'nonexistent-brief-id' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when providers is empty', async () => {
    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .send({ providers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('providers');
  });

  it('returns 400 when providers is missing', async () => {
    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('providers');
  });

  it('returns 400 when providers contains an invalid provider value', async () => {
    const res = await request(app)
      .post(`/api/trees/${treeId}/research`)
      .send({ providers: ['claude', 'invalid-provider'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Invalid provider');
    expect(res.body.error.message).toContain('invalid-provider');
  });
});
