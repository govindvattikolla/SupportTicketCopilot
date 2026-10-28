import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/db';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Health and Application Endpoints', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  beforeAll(async () => {
    testDb = await createTestDatabase('health');
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('GET /api/health should return 200 OK when database is connected', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toBe('supportflow-api');
    expect(response.body.data.database.status).toBe('connected');
    expect(response.body.data.database.healthy).toBe(true);
    expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(response.body.data.timestamp).toBeDefined();
  });

  it('GET /api/nonexistent should return 404 with standardized error envelope', async () => {
    const response = await request(app).get('/api/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toContain('Endpoint not found');
  });

  it('GET /api/health should return 503 degraded when database is disconnected', async () => {
    // Temporarily disconnect mongoose
    await mongoose.disconnect();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.database.status).toBe('disconnected');
    expect(response.body.data.database.healthy).toBe(false);

    // Reconnect for subsequent tests / clean teardown
    const uri = testDb.uri;
    await connectDatabase(uri);
  });
});
