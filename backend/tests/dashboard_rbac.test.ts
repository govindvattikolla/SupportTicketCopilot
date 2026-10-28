import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { AuditEvent } from '../src/modules/audit/audit.model';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Phase 3 - Dashboards, Reporting, and RBAC Security Suite', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspace: any;
  let adminUser: any;
  let leadUser: any;
  let agentUser: any;

  let adminToken: string;
  let leadToken: string;
  let agentToken: string;

  let sampleTicket: any;
  let unassignedTicket: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('dashboard_rbac');

    // Setup Workspace
    workspace = await Workspace.create({
      name: 'Acme SaaS Support',
      slug: 'acme',
      ticketCounter: 1000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    const hash = await bcrypt.hash('Password123!', 10);

    adminUser = await User.create({
      workspaceId: workspace._id,
      name: 'Admin Alice',
      email: 'admin@acme.com',
      passwordHash: hash,
      role: 'admin',
    });

    leadUser = await User.create({
      workspaceId: workspace._id,
      name: 'Lead Bob',
      email: 'lead@acme.com',
      passwordHash: hash,
      role: 'lead',
    });

    agentUser = await User.create({
      workspaceId: workspace._id,
      name: 'Agent Charlie',
      email: 'agent@acme.com',
      passwordHash: hash,
      role: 'agent',
    });

    // Obtain tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@acme.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.token;

    const leadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lead@acme.com', password: 'Password123!' });
    leadToken = leadLogin.body.data.token;

    const agentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@acme.com', password: 'Password123!' });
    agentToken = agentLogin.body.data.token;

    // Seed test tickets
    sampleTicket = await Ticket.create({
      workspaceId: workspace._id,
      ticketNumber: 'TCK-1001',
      trackingToken: 'token1001_12345678901234567890123456789012',
      customer: { name: 'Customer One', email: 'c1@test.com' },
      subject: 'Urgent login failure',
      description: 'Cannot login to account',
      category: 'technical',
      priority: 'P1',
      status: 'open',
      assignedTo: agentUser._id,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago -> Overdue P1
    });

    unassignedTicket = await Ticket.create({
      workspaceId: workspace._id,
      ticketNumber: 'TCK-1002',
      trackingToken: 'token1002_12345678901234567890123456789012',
      customer: { name: 'Customer Two', email: 'c2@test.com' },
      subject: 'Billing inquiry',
      description: 'Need receipt for Q3 invoice',
      category: 'billing',
      priority: 'P2',
      status: 'open',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    await Ticket.create({
      workspaceId: workspace._id,
      ticketNumber: 'TCK-1003',
      trackingToken: 'token1003_12345678901234567890123456789012',
      customer: { name: 'Customer Three', email: 'c3@test.com' },
      subject: 'Feature request for dark mode',
      description: 'Please add a dark theme option',
      category: 'feature_request',
      priority: 'P3',
      status: 'resolved',
      assignedTo: leadUser._id,
      resolvedAt: new Date(),
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  // -------------------------------------------------------------
  // AGENT DASHBOARD TESTS
  // -------------------------------------------------------------
  it('1. Agent can fetch agent dashboard summary with real computed counts', async () => {
    const res = await request(app)
      .get('/api/reports/agent-summary')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.myOpenCount).toBe(1); // TCK-1001 is open and assigned to agent
    expect(res.body.data.myHighPriorityCount).toBe(1); // P1
    expect(res.body.data.myOverdueCount).toBe(1); // P1 created 5h ago is overdue
    expect(res.body.data.highPriorityTickets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.overdueTickets.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Agent can filter ticket inbox with assignedTo=me and overdue=true', async () => {
    const res = await request(app)
      .get('/api/tickets?assignedTo=me&overdue=true')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tickets.length).toBe(1);
    expect(res.body.data.tickets[0].ticketNumber).toBe('TCK-1001');
  });

  // -------------------------------------------------------------
  // RBAC SECURITY: AGENT ACCESS ATTEMPTS TO LEAD / ADMIN ENDPOINTS
  // -------------------------------------------------------------
  it('3. Security: Agent receives 403 Forbidden when requesting Team Lead report', async () => {
    const res = await request(app)
      .get('/api/reports/team')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('4. Security: Agent receives 403 Forbidden when requesting Workspace Admin overview', async () => {
    const res = await request(app)
      .get('/api/reports/admin')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('5. Security: Agent receives 403 Forbidden when attempting to modify workspace settings', async () => {
    const res = await request(app)
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Hacked Workspace Name' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('6. Security: Agent receives 403 Forbidden when attempting to create a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        name: 'Attacker User',
        email: 'attacker@acme.com',
        password: 'Password123!',
        role: 'admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('7. Security: Agent receives 403 Forbidden when attempting to view audit logs', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------
  // TEAM LEAD DASHBOARD & RBAC TESTS
  // -------------------------------------------------------------
  it('8. Team Lead can fetch team workload, unassigned tickets, and agent workload comparison', async () => {
    const res = await request(app)
      .get('/api/reports/team')
      .set('Authorization', `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.teamWorkload.totalTickets).toBe(3);
    expect(data.teamWorkload.unassignedTickets).toBe(1); // TCK-1002
    expect(data.teamWorkload.overdueTickets).toBeGreaterThanOrEqual(1);
    expect(data.agentWorkloads.length).toBe(3); // admin, lead, agent

    const agentWorkload = data.agentWorkloads.find(
      (w: any) => w.user.email === 'agent@acme.com'
    );
    expect(agentWorkload).toBeDefined();
    expect(agentWorkload.totalAssigned).toBe(1);
    expect(agentWorkload.openCount).toBe(1);

    expect(data.unassignedTickets.length).toBe(1);
    expect(data.unassignedTickets[0].ticketNumber).toBe('TCK-1002');
  });

  it('9. Team Lead can reassign an unassigned ticket to an agent', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${unassignedTicket._id}/assign`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ assignedTo: agentUser._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify persistence in MongoDB
    const updated = await Ticket.findById(unassignedTicket._id);
    expect(updated?.assignedTo?.toString()).toBe(agentUser._id.toString());
  });

  it('10. Security: Team Lead receives 403 Forbidden when attempting to create a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        name: 'New Agent',
        email: 'newagent@acme.com',
        password: 'Password123!',
        role: 'agent',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('11. Security: Team Lead receives 403 Forbidden when requesting Admin overview', async () => {
    const res = await request(app)
      .get('/api/reports/admin')
      .set('Authorization', `Bearer ${leadToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('12. Security: Team Lead receives 403 Forbidden when requesting Agent dashboard summary', async () => {
    const res = await request(app)
      .get('/api/reports/agent-summary')
      .set('Authorization', `Bearer ${leadToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('13. Security: Admin receives 403 Forbidden when requesting Agent dashboard summary', async () => {
    const res = await request(app)
      .get('/api/reports/agent-summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('14. Security: Admin receives 403 Forbidden when requesting Team Lead report', async () => {
    const res = await request(app)
      .get('/api/reports/team')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // -------------------------------------------------------------
  // ADMIN DASHBOARD TESTS
  // -------------------------------------------------------------
  it('12. Admin can fetch workspace admin overview and statistics', async () => {
    const res = await request(app)
      .get('/api/reports/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.workspace.name).toBe('Acme SaaS Support');
    expect(data.ticketCounts.total).toBe(3);
    expect(data.ticketCounts.byPriority.P1).toBe(1);
    expect(data.ticketCounts.byPriority.P2).toBe(1);
    expect(data.ticketCounts.byPriority.P3).toBe(1);
    expect(data.teamStats.totalMembers).toBe(3);
  });

  it('13. Admin can update workspace settings', async () => {
    const res = await request(app)
      .patch('/api/workspaces/current/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Acme SaaS Global Support',
        defaultPriority: 'P2',
        allowCustomerReopen: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Acme SaaS Global Support');
    expect(res.body.data.settings.defaultPriority).toBe('P2');
    expect(res.body.data.settings.allowCustomerReopen).toBe(false);
  });

  it('14. Admin can create a new team member and update their role', async () => {
    // Create new user
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Diana Newbie',
        email: 'diana@acme.com',
        password: 'Password123!',
        role: 'agent',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const newUserId = createRes.body.data._id;

    // Promote new user to lead
    const updateRes = await request(app)
      .patch(`/api/users/${newUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'lead' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.role).toBe('lead');
  });

  it('15. Admin can query paginated audit history logs', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.events)).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('16. Unauthenticated requests to any dashboard endpoint return 401 Unauthorized', async () => {
    const resSummary = await request(app).get('/api/reports/agent-summary');
    expect(resSummary.status).toBe(401);

    const resTeam = await request(app).get('/api/reports/team');
    expect(resTeam.status).toBe(401);

    const resAdmin = await request(app).get('/api/reports/admin');
    expect(resAdmin.status).toBe(401);
  });
});
