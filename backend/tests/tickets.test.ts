import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { Message } from '../src/modules/messages/message.model';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Phase 2 - Complete Ticket Lifecycle & Security Suite', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspaceA: any;
  let workspaceB: any;
  let agentA: any;
  let agentB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    testDb = await createTestDatabase('tickets');

    // Setup Workspace A
    workspaceA = await Workspace.create({
      name: 'Workspace Alpha',
      slug: 'alpha',
      ticketCounter: 1000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    // Setup Workspace B (for tenant isolation tests)
    workspaceB = await Workspace.create({
      name: 'Workspace Beta',
      slug: 'beta',
      ticketCounter: 2000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    const hash = await bcrypt.hash('Password123!', 10);

    agentA = await User.create({
      workspaceId: workspaceA._id,
      name: 'Agent Alpha',
      email: 'agent.alpha@supportflow.com',
      passwordHash: hash,
      role: 'agent',
    });

    agentB = await User.create({
      workspaceId: workspaceB._id,
      name: 'Agent Beta',
      email: 'agent.beta@supportflow.com',
      passwordHash: hash,
      role: 'agent',
    });

    // Login Agent A
    const loginResA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent.alpha@supportflow.com', password: 'Password123!' });
    tokenA = loginResA.body.data.token;

    // Login Agent B
    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent.beta@supportflow.com', password: 'Password123!' });
    tokenB = loginResB.body.data.token;
  });

  afterAll(async () => {
    await testDb.close();
  });

  let createdTicketNumber: string;
  let createdTrackingToken: string;
  let ticketId: string;

  it('1. Customer can submit a ticket via public support form', async () => {
    const res = await request(app)
      .post('/api/public/tickets')
      .send({
        workspaceSlug: 'alpha',
        name: 'Jane Customer',
        email: 'jane@example.com',
        subject: 'Cannot login to my account after password reset',
        description: 'Received the reset email but clicking the link gives invalid token error.',
        category: 'technical',
        priority: 'P2',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketNumber).toBe('TCK-1001');
    expect(res.body.data.trackingToken).toBeDefined();
    expect(res.body.data.trackingToken.length).toBe(64);
    expect(res.body.data.trackingUrl).toContain(res.body.data.trackingToken);

    createdTicketNumber = res.body.data.ticketNumber;
    createdTrackingToken = res.body.data.trackingToken;

    // Retrieve internal ID
    const ticketDoc = await Ticket.findOne({ trackingToken: createdTrackingToken });
    expect(ticketDoc).not.toBeNull();
    ticketId = ticketDoc!._id.toString();
  });

  it('2. Customer can track ticket via unguessable token and sees initial status', async () => {
    const res = await request(app).get(`/api/public/tickets/track/${createdTrackingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.ticketNumber).toBe(createdTicketNumber);
    expect(res.body.data.ticket.trackingToken).toBe(createdTrackingToken);
    expect(res.body.data.ticket.status).toBe('open');
    expect(res.body.data.ticket.priority).toBe('P2');
    expect(res.body.data.messages).toHaveLength(0);
  });

  it('2a. Customer can track ticket directly using ticket number (e.g. TCK-1001)', async () => {
    const res = await request(app).get(`/api/public/tickets/track/${createdTicketNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.ticketNumber).toBe(createdTicketNumber);
    expect(res.body.data.ticket.trackingToken).toBe(createdTrackingToken);
    expect(res.body.data.ticket.status).toBe('open');
  });

  it('2b. Customer can track ticket using lowercase ticket number (e.g. tck-1001)', async () => {
    const res = await request(app).get(`/api/public/tickets/track/${createdTicketNumber.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.ticketNumber).toBe(createdTicketNumber);
  });

  it('2c. Customer can track ticket using bare numeric ID (e.g. 1001)', async () => {
    const bareNumber = createdTicketNumber.replace('TCK-', '');
    const res = await request(app).get(`/api/public/tickets/track/${bareNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.ticketNumber).toBe(createdTicketNumber);
  });

  it('2d. Tracking non-existent ticket number returns 404', async () => {
    const res = await request(app).get('/api/public/tickets/track/TCK-9999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('3. Staff can add both public replies and private internal notes', async () => {
    // Add public reply
    const replyRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'reply',
        content: 'Hi Jane, we received your report and are investigating the auth service.',
      });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.type).toBe('reply');

    // Add private internal note
    const noteRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'internal_note',
        content: 'Internal note: Redis token cache had an eviction spike at 14:00.',
      });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.type).toBe('internal_note');
  });

  it('4. Message Visibility Security: Customer CANNOT see internal notes', async () => {
    const res = await request(app).get(`/api/public/tickets/track/${createdTrackingToken}`);

    expect(res.status).toBe(200);
    const messages = res.body.data.messages;

    // Should only have 1 message (the public reply)
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('reply');
    expect(messages[0].content).toContain('Hi Jane');

    // Verify internal note is NEVER exposed
    const hasInternalNote = messages.some((m: any) => m.type === 'internal_note');
    expect(hasInternalNote).toBe(false);
  });

  it('5. Staff ticket details endpoint returns both replies and internal notes with audit events', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(2);
    expect(res.body.data.auditEvents.length).toBeGreaterThanOrEqual(3);
  });

  it('5a. Staff can retrieve ticket details using ticket number (e.g. TCK-1001)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${createdTicketNumber}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ticket.ticketNumber).toBe(createdTicketNumber);
    expect(res.body.data.ticket._id).toBe(ticketId);
  });

  it('6. Staff can filter, search, and paginate tickets', async () => {
    const res = await request(app)
      .get('/api/tickets?status=open&search=password')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tickets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.page).toBe(1);
  });

  it('7. Ticket State Machine: Valid transitions succeed, invalid transitions are rejected', async () => {
    // Valid transition: open -> in_progress
    const validRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'in_progress' });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.status).toBe('in_progress');

    // Invalid transition: in_progress -> open (not permitted by state machine)
    const invalidRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'open' });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.message).toContain('Invalid status transition');

    // Valid transition: in_progress -> resolved
    const resolveRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'resolved' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
    expect(resolveRes.body.data.resolvedAt).toBeDefined();
  });

  it('8. Customer follow-up reply automatically reopens a resolved ticket', async () => {
    const res = await request(app)
      .post(`/api/public/tickets/track/${createdTrackingToken}/messages`)
      .send({ content: 'Still having issues when clicking the second link.' });

    expect(res.status).toBe(201);

    // Verify ticket status transitioned back to open
    const ticketDoc = await Ticket.findById(ticketId);
    expect(ticketDoc?.status).toBe('open');
  });

  it('8a. Customer can post follow-up reply using ticket number (e.g. TCK-1001)', async () => {
    const res = await request(app)
      .post(`/api/public/tickets/track/${createdTicketNumber}/messages`)
      .send({ content: 'Follow-up posted using TCK-1001 ticket reference.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Follow-up posted using TCK-1001 ticket reference.');
  });

  it('9. Staff can assign and reassign tickets', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assignedTo: agentA._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo.toString()).toBe(agentA._id.toString());
  });

  it('10. Multi-Tenant Isolation: Agent from Workspace B CANNOT access tickets from Workspace A', async () => {
    // Agent B tries to access ticket from Workspace A
    const detailRes = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(detailRes.status).toBe(404);
    expect(detailRes.body.error.message).toContain('Ticket not found in this workspace');

    // Agent B lists tickets -> receives empty list (does not see Workspace A tickets)
    const listRes = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.tickets).toHaveLength(0);
  });
});
