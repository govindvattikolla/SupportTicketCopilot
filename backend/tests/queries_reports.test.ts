import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { TicketQuery } from '../src/modules/ticketQueries/ticketQuery.model';
import { AdminReport } from '../src/modules/adminReports/adminReport.model';
import { AuditEvent } from '../src/modules/audit/audit.model';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Role Communication & Hierarchy Suite: Agent <-> Lead and Lead <-> Admin', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspace: any;
  let adminUser: any;
  let leadUser: any;
  let agentUser: any;

  let adminToken: string;
  let leadToken: string;
  let agentToken: string;

  let testTicket: any;
  let createdQueryId: string;
  let createdReportId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase('queries_reports');

    // 1. Create Workspace
    workspace = await Workspace.create({
      name: 'Test Enterprise Support',
      slug: 'test-ent',
      ticketCounter: 2000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    const hash = await bcrypt.hash('Password123!', 10);

    // 2. Create Users
    adminUser = await User.create({
      workspaceId: workspace._id,
      name: 'System Admin',
      email: 'admin@testent.com',
      passwordHash: hash,
      role: 'admin',
    });

    leadUser = await User.create({
      workspaceId: workspace._id,
      name: 'Operations Lead',
      email: 'lead@testent.com',
      passwordHash: hash,
      role: 'lead',
    });

    agentUser = await User.create({
      workspaceId: workspace._id,
      name: 'Frontline Agent',
      email: 'agent@testent.com',
      passwordHash: hash,
      role: 'agent',
    });

    // 3. Login and grab tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@testent.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.token;

    const leadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lead@testent.com', password: 'Password123!' });
    leadToken = leadLogin.body.data.token;

    const agentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@testent.com', password: 'Password123!' });
    agentToken = agentLogin.body.data.token;

    // 4. Create test ticket
    testTicket = await Ticket.create({
      workspaceId: workspace._id,
      ticketNumber: 'TCK-2001',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Acme Client', email: 'client@acme.com' },
      subject: 'Inquiry regarding data export quota limits',
      description: 'We are requesting an export of 500,000 records but hit API rate limit.',
      category: 'technical',
      priority: 'P2',
      status: 'open',
      assignedTo: agentUser._id,
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  // --------------------------------------------------------------------------
  // Agent <-> Team Lead Ticket Queries
  // --------------------------------------------------------------------------
  describe('Agent <-> Team Lead Ticket Queries', () => {
    it('1. Agent can raise a query to Team Lead tied to a specific ticket ID', async () => {
      const res = await request(app)
        .post('/api/ticket-queries')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          ticketId: testTicket._id.toString(),
          subject: 'Need authorization to increase data export batch limit',
          category: 'technical',
          urgency: 'high',
          message: 'Client requires 500k export for annual regulatory filing. Can we lift the 50k batch cap?',
          leadId: leadUser._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketNumber).toBe('TCK-2001');
      expect(res.body.data.status).toBe('open');
      expect(res.body.data.agentName).toBe('Frontline Agent');
      expect(res.body.data.messages).toHaveLength(1);

      createdQueryId = res.body.data._id;
    });

    it('2. Agent can list their own queries with summary metrics', async () => {
      const res = await request(app)
        .get('/api/ticket-queries')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queries.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.open).toBeGreaterThanOrEqual(1);
    });

    it('3. Team Lead can view all agent queries in the workspace', async () => {
      const res = await request(app)
        .get('/api/ticket-queries')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.queries.find((q: any) => q._id === createdQueryId);
      expect(found).toBeDefined();
      expect(found.subject).toContain('Need authorization');
    });

    it('4. Team Lead can reply to the query and status automatically advances to in_review', async () => {
      const res = await request(app)
        .post(`/api/ticket-queries/${createdQueryId}/messages`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          message: 'Approved for a 24-hour window. I have applied a temporary rate exception in the API gateway.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_review');
      expect(res.body.data.messages).toHaveLength(2);
      expect(res.body.data.messages[1].senderRole).toBe('lead');
    });

    it('5. Team Lead can resolve the query with resolution summary', async () => {
      const res = await request(app)
        .patch(`/api/ticket-queries/${createdQueryId}/status`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          status: 'resolved',
          resolutionSummary: 'Temporary gateway exception granted for 24h. Client notified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.resolutionSummary).toContain('gateway exception');
    });
  });

  // --------------------------------------------------------------------------
  // Team Lead <-> Admin Operational Reports & Escalations
  // --------------------------------------------------------------------------
  describe('Team Lead <-> Admin Reports & Escalations', () => {
    it('6. Agent is denied (403) from accessing Admin Reports', async () => {
      const postRes = await request(app)
        .post('/api/admin-reports')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          title: 'Unauthorized Agent Report',
          category: 'general_update',
          priority: 'low',
          summary: 'Agent should not have access to submit admin reports.',
        });
      expect(postRes.status).toBe(403);

      const getRes = await request(app)
        .get('/api/admin-reports')
        .set('Authorization', `Bearer ${agentToken}`);
      expect(getRes.status).toBe(403);
    });

    it('7. Team Lead can submit an operational report / incident escalation to Admin', async () => {
      const res = await request(app)
        .post('/api/admin-reports')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          title: 'Export Cluster Memory Saturation & Throttling Risk',
          category: 'sla_bottleneck',
          priority: 'critical',
          summary: 'Multiple high-volume clients hitting export limits simultaneously. Worker memory utilization exceeded 92%.',
          actionRequired: 'Requesting Admin approve temporary autoscale worker pool increase.',
          ticketId: testTicket._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Export Cluster');
      expect(res.body.data.priority).toBe('critical');
      expect(res.body.data.status).toBe('submitted');
      expect(res.body.data.leadName).toBe('Operations Lead');
      expect(res.body.data.ticketNumber).toBe('TCK-2001');

      createdReportId = res.body.data._id;
    });

    it('8. Admin can list operational reports and inspect summary counts', async () => {
      const res = await request(app)
        .get('/api/admin-reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.submitted).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.critical).toBeGreaterThanOrEqual(1);
    });

    it('9. Admin can reply to report discussion and status automatically transitions to in_progress', async () => {
      const res = await request(app)
        .post(`/api/admin-reports/${createdReportId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Autoscale ceiling increased to 10 nodes for the next 48 hours. Monitoring memory metrics now.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.messages).toHaveLength(2);
      expect(res.body.data.messages[1].senderRole).toBe('admin');
    });

    it('10. Admin can resolve report with directive', async () => {
      const res = await request(app)
        .patch(`/api/admin-reports/${createdReportId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          adminDirective: 'Autoscale policy permanently updated in terraform repo. Incident mitigated.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.adminDirective).toContain('permanently updated');
    });

    it('11. Workspace audit ledger captures query and report creation and mutations', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const actions = res.body.data.events.map((e: any) => e.action);
      expect(actions).toContain('ticket_query_created');
      expect(actions).toContain('ticket_query_status_changed');
      expect(actions).toContain('admin_report_created');
      expect(actions).toContain('admin_report_status_changed');
    });
  });
});
