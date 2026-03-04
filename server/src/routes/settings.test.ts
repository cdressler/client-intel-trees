import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { createApp } from '../app.js';
import type express from 'express';

describe('Settings Routes', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/settings/default-provider', () => {
    it('returns the stored default provider', async () => {
      // The DB migration seeds default_provider = 'claude'
      const res = await request(app).get('/api/settings/default-provider');

      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('claude');
    });

    it('returns the updated provider after PUT', async () => {
      await request(app)
        .put('/api/settings/default-provider')
        .send({ provider: 'gemini' });

      const res = await request(app).get('/api/settings/default-provider');

      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('gemini');
    });
  });

  describe('PUT /api/settings/default-provider', () => {
    it('sets a valid provider and returns it', async () => {
      const res = await request(app)
        .put('/api/settings/default-provider')
        .send({ provider: 'chatgpt' });

      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('chatgpt');
    });

    it('returns 400 for an invalid provider value', async () => {
      const res = await request(app)
        .put('/api/settings/default-provider')
        .send({ provider: 'invalid-provider' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid provider');
    });

    it('returns 400 when provider is missing', async () => {
      const res = await request(app)
        .put('/api/settings/default-provider')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
