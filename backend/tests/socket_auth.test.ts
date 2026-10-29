import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { initSocketServer, getSocketServer } from '../src/realtime/socket';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { env } from '../src/config/env';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Phase 4 - Socket.IO Real-Time Authentication & Room Authorization Suite', () => {
  let testDb: TestDbInstance;
  let server: http.Server;
  let serverPort: number;

  let workspaceA: any;
  let workspaceB: any;
  let userA: any;
  let tokenA: string;

  let ticketA: any;
  let ticketB: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('socket_auth');

    // Setup Workspace A
    workspaceA = await Workspace.create({
      name: 'Workspace Alpha',
      slug: 'alpha',
      ticketCounter: 100,
    });

    // Setup Workspace B (foreign tenant)
    workspaceB = await Workspace.create({
      name: 'Workspace Beta',
      slug: 'beta',
      ticketCounter: 200,
    });

    const hash = await bcrypt.hash('Password123!', 10);
    userA = await User.create({
      workspaceId: workspaceA._id,
      name: 'Agent Alpha',
      email: 'agent@alpha.com',
      passwordHash: hash,
      role: 'agent',
    });

    tokenA = jwt.sign(
      {
        userId: userA._id.toString(),
        workspaceId: workspaceA._id.toString(),
        role: userA.role,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    ticketA = await Ticket.create({
      workspaceId: workspaceA._id,
      ticketNumber: 'TCK-101',
      trackingToken: 'token-alpha-101',
      customer: { name: 'Alpha Customer', email: 'cust@alpha.com' },
      subject: 'Alpha Ticket',
      description: 'Alpha description',
    });

    ticketB = await Ticket.create({
      workspaceId: workspaceB._id,
      ticketNumber: 'TCK-201',
      trackingToken: 'token-beta-201',
      customer: { name: 'Beta Customer', email: 'cust@beta.com' },
      subject: 'Beta Ticket (Confidential)',
      description: 'Beta description',
    });

    // Start HTTP and Socket.IO server
    const app = createApp();
    server = http.createServer(app);
    initSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    const ioServer = getSocketServer();
    if (ioServer) {
      ioServer.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await testDb.close();
  });

  it('should reject Socket.IO connection without authentication token', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    const connectErrorPromise = new Promise((resolve) => {
      client.on('connect_error', (err) => resolve(err.message));
    });

    client.connect();
    const errorMsg = await connectErrorPromise;
    client.disconnect();

    expect(errorMsg).toMatch(/Authentication error: Missing token/i);
  });

  it('should reject Socket.IO connection with an invalid JWT signature', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid_malformed_token_signature' },
      transports: ['websocket'],
      autoConnect: false,
    });

    const connectErrorPromise = new Promise((resolve) => {
      client.on('connect_error', (err) => resolve(err.message));
    });

    client.connect();
    const errorMsg = await connectErrorPromise;
    client.disconnect();

    expect(errorMsg).toMatch(/Authentication error/i);
  });

  it('should successfully authenticate and connect with a valid JWT token', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenA },
      transports: ['websocket'],
      autoConnect: false,
    });

    const connectPromise = new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
    });

    client.connect();
    await connectPromise;
    expect(client.connected).toBe(true);

    client.disconnect();
  });

  it('should permit joining a ticket room belonging to user workspace', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    const joinResult = await new Promise<any>((resolve) => {
      client.emit('join_ticket', { ticketId: ticketA._id.toString() }, (res: any) => {
        resolve(res);
      });
    });

    expect(joinResult.success).toBe(true);
    expect(joinResult.room).toBe(`ticket:${ticketA._id.toString()}`);

    client.disconnect();
  });

  it('should prevent unauthorized room join and block cross-tenant ticket subscription', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    // User A attempts to join Ticket B which belongs to Workspace B
    const joinResult = await new Promise<any>((resolve) => {
      client.emit('join_ticket', { ticketId: ticketB._id.toString() }, (res: any) => {
        resolve(res);
      });
    });

    expect(joinResult.success).toBe(false);
    expect(joinResult.error).toMatch(/Forbidden: Cannot subscribe to ticket outside your workspace/i);

    client.disconnect();
  });
});
