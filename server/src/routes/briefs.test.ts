import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../db.js';
import { createApp } from '../app.js';
import type express from 'express';

describe('Brief Routes', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/briefs', () => {
    it('returns 201 with Brief when uploading a valid TXT file', async () => {
      const res = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('Hello brief content'), 'research.txt')
        .field('name', 'My Research Brief');

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'My Research Brief',
        fileType: 'txt',
        createdAt: expect.any(String),
      });
      // text should not be in the list-style response
      expect(res.body.text).toBeUndefined();
    });

    it('returns 400 when uploading a file with unsupported extension', async () => {
      const res = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('some data'), 'image.png');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Unsupported file type');
    });

    it('returns 400 when no file is provided', async () => {
      const res = await request(app)
        .post('/api/briefs')
        .field('name', 'No File Brief');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('No file provided');
    });

    it('uses the original filename as name when no name field is provided', async () => {
      const res = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('content'), 'auto-name.txt');

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('auto-name.txt');
    });
  });

  describe('GET /api/briefs', () => {
    it('returns an empty array when no briefs exist', async () => {
      const res = await request(app).get('/api/briefs');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all created briefs', async () => {
      await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('text1'), 'a.txt')
        .field('name', 'Brief A');

      await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('text2'), 'b.txt')
        .field('name', 'Brief B');

      const res = await request(app).get('/api/briefs');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /api/briefs/:id', () => {
    it('returns brief detail including text', async () => {
      const createRes = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('detailed content'), 'detail.txt')
        .field('name', 'Detail Brief');

      const res = await request(app).get(`/api/briefs/${createRes.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.text).toBe('detailed content');
    });

    it('returns 404 for unknown ID', async () => {
      const res = await request(app).get('/api/briefs/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/briefs/:id', () => {
    it('updates brief content', async () => {
      const createRes = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('original'), 'orig.txt')
        .field('name', 'Update Me');

      const updateRes = await request(app)
        .put(`/api/briefs/${createRes.body.id}`)
        .attach('file', Buffer.from('updated'), 'new.txt');

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(createRes.body.id);

      const getRes = await request(app).get(`/api/briefs/${createRes.body.id}`);
      expect(getRes.body.text).toBe('updated');
    });

    it('returns 404 when updating a non-existent brief', async () => {
      const res = await request(app)
        .put('/api/briefs/ghost-id')
        .attach('file', Buffer.from('data'), 'file.txt');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/briefs/:id', () => {
    it('deletes an existing brief and returns 204', async () => {
      const createRes = await request(app)
        .post('/api/briefs')
        .attach('file', Buffer.from('to delete'), 'del.txt')
        .field('name', 'Delete Me');

      const delRes = await request(app).delete(`/api/briefs/${createRes.body.id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/api/briefs/${createRes.body.id}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 when deleting an unknown ID', async () => {
      const res = await request(app).delete('/api/briefs/unknown-id');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
