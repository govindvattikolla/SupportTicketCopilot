import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { TicketQuery } from '../src/modules/ticketQueries/ticketQuery.model';
import { createTestDatabase, TestDbInstance } from './testDb';
import {
  evaluateTicketUrgency,
  calculateWaitingTimeScore,
  calculateSLAPressureScore,
  calculateAssignmentScore,
} from '../src/modules/operations/urgencyRanking.service';
import {
  calculateExpertiseScore,
  calculateWorkloadScore,
  calculateAvailabilityScore,
} from '../src/modules/operations/agentRecommendation.service';
import {
  tokenizeText,
  calculateJaccardSimilarity,
  clusterTickets,
} from '../src/modules/operations/clustering.service';

describe('Phase 5 - Explainable Operational Intelligence Suite', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspaceA: any;
  let workspaceB: any;
  let adminToken: string;
  let leadToken: string;
  let agent1Token: string;
  let agent2Token: string;

  let agent1: any;
  let agent2: any;
  let leadUser: any;
  let adminUser: any;

  let ticketP1Unassigned: any;
  let ticketP2Assigned: any;
  let ticketP4Old: any;
  let ticketBugEngineering: any;
  let ticketPendingCustomer: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('phase5_operations');

    // 1. Create Workspaces
    workspaceA = await Workspace.create({
      name: 'Alpha Ops Workspace',
      slug: 'alpha-ops',
      ticketCounter: 3000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    workspaceB = await Workspace.create({
      name: 'Beta Isolated Workspace',
      slug: 'beta-ops',
      ticketCounter: 4000,
      settings: { defaultPriority: 'P3', allowCustomerReopen: true },
    });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 2. Create Users with specific skills and max capacities
    adminUser = await User.create({
      workspaceId: workspaceA._id,
      name: 'Alice Admin',
      email: 'alice.admin@alphaops.test',
      passwordHash,
      role: 'admin',
      skills: ['general'],
      maxCapacity: 10,
      isActive: true,
    });

    leadUser = await User.create({
      workspaceId: workspaceA._id,
      name: 'Leo Lead',
      email: 'leo.lead@alphaops.test',
      passwordHash,
      role: 'lead',
      skills: ['technical', 'bug'],
      maxCapacity: 8,
      isActive: true,
    });

    // Agent 1: Billing and General specialist
    agent1 = await User.create({
      workspaceId: workspaceA._id,
      name: 'Bob Billing',
      email: 'bob.billing@alphaops.test',
      passwordHash,
      role: 'agent',
      skills: ['billing', 'general'],
      maxCapacity: 5,
      isActive: true,
    });

    // Agent 2: Technical and Bug specialist
    agent2 = await User.create({
      workspaceId: workspaceA._id,
      name: 'Tina Tech',
      email: 'tina.tech@alphaops.test',
      passwordHash,
      role: 'agent',
      skills: ['technical', 'bug'],
      maxCapacity: 5,
      isActive: true,
    });

    // Inactive agent to test availability exclusion
    await User.create({
      workspaceId: workspaceA._id,
      name: 'Ian Inactive',
      email: 'ian.inactive@alphaops.test',
      passwordHash,
      role: 'agent',
      skills: ['technical'],
      maxCapacity: 5,
      isActive: false,
    });

    // 3. Login and grab tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice.admin@alphaops.test', password: 'Password123!' });
    adminToken = adminLogin.body.data.token;

    const leadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'leo.lead@alphaops.test', password: 'Password123!' });
    leadToken = leadLogin.body.data.token;

    const agent1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob.billing@alphaops.test', password: 'Password123!' });
    agent1Token = agent1Login.body.data.token;

    const agent2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tina.tech@alphaops.test', password: 'Password123!' });
    agent2Token = agent2Login.body.data.token;

    // 4. Create Tickets with various operational states
    const now = new Date();

    // Ticket 1: P1 Unassigned, recent, approaching SLA
    ticketP1Unassigned = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3001',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Urgent User', email: 'urgent@corp.com' },
      subject: 'Critical database connection pool exhaustion',
      description: 'Database connection pool is fully exhausted causing 500 error spikes.',
      category: 'technical',
      priority: 'P1',
      status: 'open',
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      sla: {
        firstResponseDeadline: new Date(now.getTime() + 45 * 60 * 1000), // 45 mins remaining
        resolutionDeadline: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        isFirstResponseBreached: false,
        isResolutionBreached: false,
        isWarningSent: false,
        isEscalated: false,
        totalPausedMinutes: 0,
        pauseHistory: [],
      },
    });

    // Ticket 2: P2 Assigned to Agent 1, SLA Breached
    ticketP2Assigned = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3002',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Billing Customer', email: 'billing@client.com' },
      subject: 'Incorrect VAT calculation on subscription invoice',
      description: 'The subscription invoice shows incorrect 25% VAT instead of 20%.',
      category: 'billing',
      priority: 'P2',
      status: 'in_progress',
      assignedTo: agent1._id,
      createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000), // 30h ago -> >24h waiting
      sla: {
        firstResponseDeadline: new Date(now.getTime() - 10 * 60 * 60 * 1000),
        resolutionDeadline: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        isFirstResponseBreached: true,
        isResolutionBreached: true,
        isWarningSent: true,
        isEscalated: true,
        totalPausedMinutes: 0,
        pauseHistory: [],
      },
    });

    // Ticket 3: P4 Old, assigned to Agent 1
    ticketP4Old = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3003',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Feature Requester', email: 'idea@growth.com' },
      subject: 'Dark mode toggle for dashboard',
      description: 'Would love an option to switch between dark and light themes.',
      category: 'feature_request',
      priority: 'P4',
      status: 'in_progress',
      assignedTo: agent1._id,
      createdAt: new Date(now.getTime() - 50 * 60 * 60 * 1000),
    });

    // Ticket 4: Bug awaiting engineering
    ticketBugEngineering = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3004',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Dev User', email: 'dev@dev.io' },
      subject: 'Null pointer exception on webhook retry serialization',
      description: 'Webhook worker throws uncaught exception when deserializing payload headers.',
      category: 'bug',
      priority: 'P2',
      status: 'open',
      awaitingEngineering: true,
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    });

    // Ticket 5: Pending customer ticket
    ticketPendingCustomer = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3005',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Slow Responder', email: 'slow@corp.com' },
      subject: 'Need more information regarding account verification',
      description: 'Waiting for customer passport upload.',
      category: 'general',
      priority: 'P3',
      status: 'pending',
      assignedTo: agent1._id,
      createdAt: new Date(now.getTime() - 100 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 80 * 60 * 60 * 1000), // > 72h stale
      sla: {
        pausedAt: new Date(now.getTime() - 80 * 60 * 60 * 1000),
        totalPausedMinutes: 4800,
        pauseHistory: [],
      },
    });

    // Create a historical resolved ticket for Agent 2 in 'technical' category
    await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-3000',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Past User', email: 'past@test.com' },
      subject: 'Resolved API issue',
      description: 'Fixed and closed API issue',
      category: 'technical',
      priority: 'P3',
      status: 'resolved',
      resolvedAt: new Date(),
      assignedTo: agent2._id,
    });

    // Cross-workspace ticket in Workspace B (must not leak into Workspace A)
    await Ticket.create({
      workspaceId: workspaceB._id,
      ticketNumber: 'TCK-4001',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      customer: { name: 'Foreign User', email: 'foreign@other.com' },
      subject: 'Workspace B Ticket',
      description: 'Isolated workspace content',
      category: 'billing',
      priority: 'P1',
      status: 'open',
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  // ==============================================================
  // 1. URGENCY RANKING & ATTENTION SCORING TESTS
  // ==============================================================
  describe('1. Urgency Ranking & Attention Score Engine', () => {
    it('accurately calculates factor components for an unassigned P1 ticket approaching SLA', () => {
      const now = new Date();
      const waiting = calculateWaitingTimeScore(ticketP1Unassigned.createdAt, ticketP1Unassigned.updatedAt, 'open', now);
      const sla = calculateSLAPressureScore(ticketP1Unassigned, now);
      const assignment = calculateAssignmentScore(ticketP1Unassigned.assignedTo);

      // P1 base points
      expect(waiting.score).toBeGreaterThanOrEqual(10); // 3h waiting -> 10 pts
      expect(sla.score).toBe(20); // 45m remaining -> critical threshold 20 pts
      expect(assignment.score).toBe(15); // Unassigned -> 15 pts

      const evaluation = evaluateTicketUrgency(ticketP1Unassigned, now);

      // Original priority is preserved and strictly separate
      expect(evaluation.originalPriority).toBe('P1');
      expect(evaluation.attentionScore).toBeGreaterThanOrEqual(75);
      expect(evaluation.urgencyTier).toBe('critical');

      // Verify all 4 explainable factors are present
      expect(evaluation.factors).toHaveLength(4);
      expect(evaluation.factors.map((f) => f.name)).toEqual([
        'Priority Weight',
        'Waiting Time',
        'SLA Pressure',
        'Assignment State',
      ]);
      expect(evaluation.explanation).toContain('Attention Score');
      expect(evaluation.explanation).toContain('P1 priority');
    });

    it('gives max SLA pressure points (30 pts) when ticket SLA is breached', () => {
      const now = new Date();
      const sla = calculateSLAPressureScore(ticketP2Assigned, now);
      expect(sla.score).toBe(30);
      expect(sla.isBreached).toBe(true);
      expect(sla.details).toContain('breached');
    });

    it('GET /api/operations/urgency-ranking returns tickets sorted by attentionScore descending with factor explanations', async () => {
      const res = await request(app)
        .get('/api/operations/urgency-ranking')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalAnalyzed).toBeGreaterThanOrEqual(4);

      const tickets = res.body.data.tickets;
      expect(tickets.length).toBeGreaterThan(0);

      // Verify descending order of attentionScore
      for (let i = 0; i < tickets.length - 1; i++) {
        expect(tickets[i].attentionScore).toBeGreaterThanOrEqual(tickets[i + 1].attentionScore);
      }

      // Check first ticket preserves originalPriority separately
      const topTicket = tickets[0];
      expect(topTicket.originalPriority).toBeDefined();
      expect(['P1', 'P2', 'P3', 'P4']).toContain(topTicket.originalPriority);
      expect(topTicket.attentionScore).toBeTypeOf('number');
      expect(topTicket.factors).toHaveLength(4);
      expect(topTicket.explanation).toBeTruthy();

      // Check tenant isolation: Workspace B tickets must NOT be present
      const foundOtherWorkspaceTicket = tickets.some((t: any) => t.ticketNumber === 'TCK-4001');
      expect(foundOtherWorkspaceTicket).toBe(false);
    });

    it('supports urgencyTier query filtering (e.g. ?urgencyTier=critical)', async () => {
      const res = await request(app)
        .get('/api/operations/urgency-ranking?urgencyTier=critical')
        .set('Authorization', `Bearer ${agent1Token}`);

      expect(res.status).toBe(200);
      for (const t of res.body.data.tickets) {
        expect(t.urgencyTier).toBe('critical');
      }
    });
  });

  // ==============================================================
  // 2. WORKLOAD-AWARE AGENT RECOMMENDATIONS TESTS
  // ==============================================================
  describe('2. Workload-Aware Agent Recommendations', () => {
    it('calculates expertise score with bonus for matching category and past resolution', () => {
      // Bob specializes in billing
      const bobBillingScore = calculateExpertiseScore(['billing', 'general'], 'billing', 0);
      expect(bobBillingScore.score).toBe(30);
      expect(bobBillingScore.details).toContain('Designated skill badge in "billing"');

      // Tina has 5 resolved tickets in technical
      const tinaTechScore = calculateExpertiseScore(['technical', 'bug'], 'technical', 5);
      expect(tinaTechScore.score).toBe(40); // 30 + 10 = 40 max
      expect(tinaTechScore.details).toContain('Extensive resolution history');

      // General fallback
      const fallbackScore = calculateExpertiseScore([], 'billing', 0);
      expect(fallbackScore.score).toBe(15);
      expect(fallbackScore.details).toContain('General support profile');
    });

    it('calculates workload bandwidth favoring idle or light queues', () => {
      const idleLoad = calculateWorkloadScore(0, 5);
      expect(idleLoad.score).toBe(40);
      expect(idleLoad.utilizationPercent).toBe(0);

      const heavyLoad = calculateWorkloadScore(3, 5);
      expect(heavyLoad.score).toBe(20);
      expect(heavyLoad.utilizationPercent).toBe(60);

      const maxedLoad = calculateWorkloadScore(5, 5);
      expect(maxedLoad.score).toBe(0);
      expect(maxedLoad.utilizationPercent).toBe(100);
    });

    it('GET /api/operations/recommendations/:ticketId ranks agents by expertise and workload with factor breakdowns', async () => {
      // ticketP1Unassigned is category 'technical'
      // Agent 2 (Tina) has skill 'technical' and 0 active tickets
      // Agent 1 (Bob) has skill 'billing' and 3 active tickets (TCK-3002, TCK-3003, TCK-3005)
      const res = await request(app)
        .get(`/api/operations/recommendations/${ticketP1Unassigned._id}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const recommendations = res.body.data.recommendations;
      expect(recommendations.length).toBeGreaterThanOrEqual(2);

      // Top recommendation must be Tina Tech (expertise match + 0 active tickets)
      const topRec = recommendations[0];
      expect(topRec.isRecommended).toBe(true);
      expect(topRec.agent.name).toBe('Tina Tech');
      expect(topRec.agent.skills).toContain('technical');
      expect(topRec.activeTicketCount).toBe(0);
      expect(topRec.matchScore).toBeGreaterThan(recommendations[1].matchScore);

      // Check all factors and explanation
      expect(topRec.factors).toHaveLength(3);
      expect(topRec.factors.map((f: any) => f.name)).toEqual([
        'Expertise Match',
        'Workload Bandwidth',
        'Availability Status',
      ]);
      expect(topRec.explanation).toContain('Match Score');

      // Verify inactive agent was excluded from candidate list
      const ianFound = recommendations.some((r: any) => r.agent.name === 'Ian Inactive');
      expect(ianFound).toBe(false);
    });

    it('GET /api/operations/recommendations/:ticketId recommends Bob Billing for billing ticket', async () => {
      // For billing ticket (ticketP2Assigned)
      const res = await request(app)
        .get(`/api/operations/recommendations/${ticketP2Assigned._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const recommendations = res.body.data.recommendations;
      const bobRec = recommendations.find((r: any) => r.agent.name === 'Bob Billing');
      expect(bobRec).toBeDefined();
      expect(bobRec.factors[0].details).toContain('billing');
    });
  });

  // ==============================================================
  // 3. RECURRING-ISSUE DETECTION & CLUSTERING TESTS
  // ==============================================================
  describe('3. Recurring-Issue Detection & Simple Similarity Clustering', () => {
    it('tokenizes text correctly, filtering stop words and short terms', () => {
      const tokens = tokenizeText('The critical database connection pool is exhausted on production 500!');
      expect(tokens.has('critical')).toBe(true);
      expect(tokens.has('database')).toBe(true);
      expect(tokens.has('connection')).toBe(true);
      expect(tokens.has('exhausted')).toBe(true);
      expect(tokens.has('production')).toBe(true);

      // Stop words & numbers must be excluded
      expect(tokens.has('the')).toBe(false);
      expect(tokens.has('is')).toBe(false);
      expect(tokens.has('on')).toBe(false);
      expect(tokens.has('500')).toBe(false);
    });

    it('computes exact Jaccard similarity between two token sets', () => {
      const setA = new Set(['webhook', 'timeout', 'latency', 'api']);
      const setB = new Set(['webhook', 'timeout', 'gateway', 'error']);
      const { similarity, sharedTokens } = calculateJaccardSimilarity(setA, setB);

      // Intersection = ['webhook', 'timeout'] (size 2)
      // Union = ['webhook', 'timeout', 'latency', 'api', 'gateway', 'error'] (size 6)
      // Jaccard = 2 / 6 = 0.3333...
      expect(similarity).toBeCloseTo(2 / 6, 3);
      expect(sharedTokens).toEqual(expect.arrayContaining(['webhook', 'timeout']));
    });

    it('clusters tickets in the same category sharing terms into a Potential Incident cluster', async () => {
      // Create two tickets in workspace A describing same webhook timeout problem
      const clusterT1 = await Ticket.create({
        workspaceId: workspaceA._id,
        ticketNumber: 'TCK-3010',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Customer One', email: 'c1@test.com' },
        subject: 'Webhook callbacks timing out after 10 seconds',
        description: 'Our webhook callbacks are consistently timing out after 10s on payment events.',
        category: 'technical',
        priority: 'P1',
        status: 'open',
      });

      const clusterT2 = await Ticket.create({
        workspaceId: workspaceA._id,
        ticketNumber: 'TCK-3011',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Customer Two', email: 'c2@test.com' },
        subject: 'Webhook deliveries failing with 10s timeout',
        description: 'Payment webhook callbacks timing out after 10s on our server.',
        category: 'technical',
        priority: 'P2',
        status: 'open',
      });

      const clusters = clusterTickets([clusterT1, clusterT2], 0.25);
      expect(clusters.length).toBe(1);

      const cluster = clusters[0];
      expect(cluster.category).toBe('technical');
      expect(cluster.ticketCount).toBe(2);
      expect(cluster.sharedKeywords).toEqual(
        expect.arrayContaining(['webhook', 'callbacks', 'timing'])
      );
      expect(cluster.isPotentialIncident).toBe(true);
      expect(cluster.disclaimer).toContain('Treat as potential incident requiring human review');
      expect(cluster.disclaimer).toContain('does not prove a shared technical root cause');
    });

    it('GET /api/operations/recurring-issues surfaces clusters with required human review disclaimer and non-LLM rationale', async () => {
      const res = await request(app)
        .get('/api/operations/recurring-issues')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.methodology).toBeDefined();
      expect(data.methodology.llmEmployed).toBe(false);
      expect(data.methodology.nonLlmRationale.privacy).toContain('never leave');
      expect(data.methodology.nonLlmRationale.cost).toContain('Zero');

      // Verify disclaimer on every cluster
      for (const cluster of data.clusters) {
        expect(cluster.isPotentialIncident).toBe(true);
        expect(cluster.disclaimer).toContain('requiring human review');
        expect(cluster.disclaimer).toContain('does not prove a shared technical root cause');
        expect(cluster.sharedKeywords).toBeDefined();
        expect(cluster.tickets.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ==============================================================
  // 4. BOTTLENECK ANALYTICS TESTS
  // ==============================================================
  describe('4. Bottleneck Analytics & Workload Imbalance Metrics', () => {
    it('GET /api/operations/bottlenecks computes accurate operational bottleneck aggregates', async () => {
      const res = await request(app)
        .get('/api/operations/bottlenecks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const bottlenecks = res.body.data;

      // 1. Unassigned Tickets
      expect(bottlenecks.unassigned.totalCount).toBeGreaterThanOrEqual(2); // TCK-3001, TCK-3004, etc.
      expect(bottlenecks.unassigned.byPriority.P1).toBeGreaterThanOrEqual(1);
      expect(bottlenecks.unassigned.oldestTickets.length).toBeGreaterThan(0);

      // 2. Pending Customer Tickets
      expect(bottlenecks.waitingForCustomer.totalCount).toBeGreaterThanOrEqual(1); // TCK-3005
      expect(bottlenecks.waitingForCustomer.staleCount).toBeGreaterThanOrEqual(1); // >72h stale
      expect(bottlenecks.waitingForCustomer.tickets[0].pendingHours).toBeGreaterThan(70);

      // 3. Tickets Awaiting Engineering
      expect(bottlenecks.awaitingEngineering.totalCount).toBeGreaterThanOrEqual(1); // TCK-3004 (bug)
      expect(bottlenecks.awaitingEngineering.tickets.some((t: any) => t.ticketNumber === 'TCK-3004')).toBe(true);

      // 4. SLA Breaches
      expect(bottlenecks.slaBreaches.totalBreached).toBeGreaterThanOrEqual(1); // TCK-3002
      expect(bottlenecks.slaBreaches.firstResponseBreached).toBeGreaterThanOrEqual(1);
      expect(bottlenecks.slaBreaches.resolutionBreached).toBeGreaterThanOrEqual(1);

      // 5. Workload Imbalance Metrics
      const workload = bottlenecks.workloadImbalance;
      expect(workload.totalActiveAgents).toBeGreaterThanOrEqual(3); // Alice Admin, Leo Lead, Bob Billing, Tina Tech
      expect(workload.meanActiveTickets).toBeTypeOf('number');
      expect(workload.standardDeviation).toBeTypeOf('number');
      expect(workload.status).toMatch(/balanced|moderate_imbalance|severe_imbalance/);
      expect(workload.agentDistribution.length).toBeGreaterThanOrEqual(3);
      expect(workload.explanation).toBeTruthy();

      // Bob Billing has multiple active tickets, Tina Tech has 0 active tickets -> identifies underutilized agent
      const tinaMetric = workload.agentDistribution.find((a: any) => a.name === 'Tina Tech');
      expect(tinaMetric).toBeDefined();
      expect(tinaMetric.activeTickets).toBe(0);
      expect(tinaMetric.isUnderutilized).toBe(true);
    });

    it('guarantees tenant isolation: does not include Workspace B in bottleneck calculations', async () => {
      const res = await request(app)
        .get('/api/operations/bottlenecks')
        .set('Authorization', `Bearer ${adminToken}`);

      const tickets = [
        ...res.body.data.unassigned.oldestTickets,
        ...res.body.data.waitingForCustomer.tickets,
        ...res.body.data.awaitingEngineering.tickets,
      ];

      const leaked = tickets.some((t: any) => t.ticketNumber === 'TCK-4001');
      expect(leaked).toBe(false);
    });
  });
});
