import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { Attachment } from '../src/modules/attachments/attachment.model';
import {
  validateAttachmentUpload,
  sanitizeFilename,
} from '../src/modules/attachments/attachment.service';
import { emailService } from '../src/modules/notifications/email.service';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Phase 6 - Production Hardening, Security, and Attachment Access Restrictions Suite', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspaceA: any;
  let workspaceB: any;
  let agentA: any;
  let agentB: any;
  let tokenA: string;
  let tokenB: string;

  let ticketA: any;
  let customerAttachment: any;
  let internalAttachment: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('phase6_hardening');

    workspaceA = await Workspace.create({
      name: 'Alpha Corp',
      slug: 'alpha-phase6',
      ticketCounter: 1000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    workspaceB = await Workspace.create({
      name: 'Beta Corp',
      slug: 'beta-phase6',
      ticketCounter: 2000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    const hash = await bcrypt.hash('Password123!', 10);

    agentA = await User.create({
      workspaceId: workspaceA._id,
      name: 'Agent Alpha',
      email: 'agent.alpha6@supportflow.com',
      passwordHash: hash,
      role: 'agent',
    });

    agentB = await User.create({
      workspaceId: workspaceB._id,
      name: 'Agent Beta',
      email: 'agent.beta6@supportflow.com',
      passwordHash: hash,
      role: 'agent',
    });

    const loginResA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent.alpha6@supportflow.com', password: 'Password123!' });
    tokenA = loginResA.body.data.token;

    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent.beta6@supportflow.com', password: 'Password123!' });
    tokenB = loginResB.body.data.token;

    // Create a public ticket in Workspace A
    const pubRes = await request(app)
      .post('/api/public/tickets')
      .send({
        workspaceSlug: 'alpha-phase6',
        name: 'Alice Customer',
        email: 'alice@example.com',
        subject: 'Cannot access exported analytics CSV',
        description: 'Receiving a 403 error when downloading the CSV attachment in settings.',
        category: 'technical',
        priority: 'P2',
      });

    ticketA = pubRes.body.data;

    // Upload a public customer attachment to ticketA
    customerAttachment = await Attachment.create({
      workspaceId: workspaceA._id,
      ticketId: (await Ticket.findOne({ ticketNumber: ticketA.ticketNumber }))!._id,
      isInternal: false,
      originalFilename: 'error_screenshot.png',
      sanitizedFilename: 'error_screenshot.png',
      storageKey: `${workspaceA._id}/error_screenshot.png`,
      mimeType: 'image/png',
      sizeBytes: 1024 * 50,
      uploadedBy: { type: 'customer', name: 'Alice Customer' },
    });

    // Upload an internal staff-only attachment to ticketA
    internalAttachment = await Attachment.create({
      workspaceId: workspaceA._id,
      ticketId: (await Ticket.findOne({ ticketNumber: ticketA.ticketNumber }))!._id,
      isInternal: true, // Internal only!
      originalFilename: 'server_dump.log',
      sanitizedFilename: 'server_dump.log',
      storageKey: `${workspaceA._id}/server_dump.log`,
      mimeType: 'text/plain',
      sizeBytes: 1024 * 10,
      uploadedBy: { type: 'agent', userId: agentA._id, name: agentA.name },
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('1. Production Health & Container Orchestration Probes', () => {
    it('GET /api/health returns full diagnostics including DB, memory, version and uptime', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.service).toBe('supportflow-api');
      expect(res.body.data.version).toBe('0.1.0');
      expect(res.body.data.database.healthy).toBe(true);
      expect(res.body.data.database.status).toBe('connected');
      expect(res.body.data.memory.heapUsedMB).toBeGreaterThan(0);
      expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/health/live returns liveness status for container orchestrators', async () => {
      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('alive');
    });

    it('GET /api/health/ready returns readiness probe confirming DB readiness', async () => {
      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.database).toBe('connected');
    });
  });

  describe('2. Security Headers, Rate Limits & Safe Error Handling', () => {
    it('Helmet security headers are present on responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('Rate limiting headers are returned on public endpoints', async () => {
      const res = await request(app).get(`/api/public/tickets/track/${ticketA.ticketNumber}`);

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });

    it('Non-existent route returns clean JSON error response without stack trace leakage', async () => {
      const res = await request(app).get('/api/invalid-endpoint-path');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Endpoint not found');
      expect(res.body.error.stack).toBeUndefined();
    });
  });

  describe('3. Attachment Access Restrictions & Security Invariants', () => {
    it('Sanitizes filenames to prevent directory traversal and null byte injections', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('report\0.pdf')).toBe('report.pdf');
      expect(sanitizeFilename('safe-document_2026.pdf')).toBe('safe-document_2026.pdf');
    });

    it('Rejects dangerous executable attachments (.exe, .sh, .bat)', () => {
      expect(() => {
        validateAttachmentUpload('malware.exe', 'application/octet-stream', 1024);
      }).toThrow('Forbidden file type');

      expect(() => {
        validateAttachmentUpload('script.sh', 'text/x-shellscript', 1024);
      }).toThrow('Forbidden file type');
    });

    it('Rejects files exceeding the 10MB size limit', () => {
      expect(() => {
        validateAttachmentUpload('huge_dump.zip', 'application/zip', 15 * 1024 * 1024);
      }).toThrow('File size exceeds 10MB limit');
    });

    it('Customer CAN download public attachments for their ticket via tracking reference', async () => {
      const res = await request(app)
        .get(`/api/public/tickets/track/${ticketA.ticketNumber}/attachments/${customerAttachment._id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.body.data.filename).toBe('error_screenshot.png');
    });

    it('STRICT SECURITY: Customer CANNOT download internal staff attachments (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/public/tickets/track/${ticketA.ticketNumber}/attachments/${internalAttachment._id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Internal staff attachments cannot be accessed');
    });

    it('Staff can download internal attachments within their own workspace', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketA.ticketNumber}/attachments/${internalAttachment._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isInternal).toBe(true);
      expect(res.body.data.filename).toBe('server_dump.log');
    });

    it('TENANT ISOLATION: Staff from Workspace B CANNOT access attachments from Workspace A (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketA.ticketNumber}/attachments/${internalAttachment._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Attachment not found in this workspace');
    });
  });

  describe('4. Background Job Deduplication & Email Delivery Idempotency', () => {
    it('Prevents duplicate email notifications when using identical deduplication keys', async () => {
      emailService.clear();

      const key = `test-dedup-key-${Date.now()}`;

      // First dispatch
      const first = await emailService.sendEmail({
        to: 'agent.alpha6@supportflow.com',
        subject: 'First Notification',
        html: '<p>Update on ticket</p>',
        deduplicationKey: key,
      });

      expect(first.sent).toBe(true);
      expect(first.duplicate).toBeUndefined();

      // Second dispatch with same key (simulating worker retry or duplicate trigger)
      const second = await emailService.sendEmail({
        to: 'agent.alpha6@supportflow.com',
        subject: 'Duplicate Notification',
        html: '<p>Update on ticket</p>',
        deduplicationKey: key,
      });

      expect(second.sent).toBe(false);
      expect(second.duplicate).toBe(true);

      // Verify only 1 email was recorded
      expect(emailService.getSentEmails()).toHaveLength(1);
    });
  });

  describe('5. Staff RBAC and Tenant Data Boundaries', () => {
    it('Agent cannot access admin-only endpoints without admin role', async () => {
      const res = await request(app)
        .get('/api/admin-reports')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('You do not have permission to perform this action');
    });

    it('Unauthenticated requests to staff routes are rejected with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/tickets');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
