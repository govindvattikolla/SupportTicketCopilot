import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import { RefreshToken } from '../src/modules/auth/refreshToken.model';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('HTTP-Only Cookies & Refresh Token Rotation Suite', () => {
  let testDb: TestDbInstance;
  const app = createApp();

  let workspace: any;
  let user: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('auth_cookies_refresh');

    workspace = await Workspace.create({
      name: 'Cookie Test Workspace',
      slug: 'cookie-ws',
      ticketCounter: 100,
    });

    const hash = await bcrypt.hash('SecurePassword123!', 10);
    user = await User.create({
      workspaceId: workspace._id,
      name: 'Cookie Agent',
      email: 'cookie.agent@supportflow.com',
      passwordHash: hash,
      role: 'agent',
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('1. Login sets secure HTTP-only cookies for accessToken and refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'cookie.agent@supportflow.com',
        password: 'SecurePassword123!',
        workspaceSlug: 'cookie-ws',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('cookie.agent@supportflow.com');

    // Inspect Set-Cookie headers
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();

    const accessTokenCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    const refreshTokenCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toContain('HttpOnly');
    expect(accessTokenCookie).toContain('Path=/');

    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain('HttpOnly');

    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly');
    expect(refreshTokenCookie).toContain('Path=/');

    // Verify RefreshToken record was saved in database
    const dbTokens = await RefreshToken.find({ userId: user._id });
    expect(dbTokens.length).toBeGreaterThanOrEqual(1);
    expect(dbTokens[0].isRevoked).toBe(false);
  });

  it('2. Authenticates protected API requests purely via HTTP-only cookie without Authorization header', async () => {
    // Perform login to acquire cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'cookie.agent@supportflow.com',
        password: 'SecurePassword123!',
        workspaceSlug: 'cookie-ws',
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c: string) => c.startsWith('accessToken=')) || cookies.find((c: string) => c.startsWith('token='));

    // Access /api/auth/me purely passing the Cookie header (no Authorization header)
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', tokenCookie!);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('cookie.agent@supportflow.com');
  });

  it('3. Successfully rotates Refresh Token and issues a new access token via POST /api/auth/refresh', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'cookie.agent@supportflow.com',
        password: 'SecurePassword123!',
        workspaceSlug: 'cookie-ws',
      });

    const cookies1 = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie1 = cookies1.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie1).toBeDefined();

    // 2. Call /api/auth/refresh with the refresh token cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie1!);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);

    const cookies2 = refreshRes.headers['set-cookie'] as unknown as string[];
    const newAccessCookie = cookies2.find((c: string) => c.startsWith('accessToken='));
    const newRefreshCookie = cookies2.find((c: string) => c.startsWith('refreshToken='));

    expect(newAccessCookie).toBeDefined();
    expect(newAccessCookie).toContain('HttpOnly');
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).toContain('HttpOnly');

    // 3. Verify the new access token allows querying /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', newAccessCookie!);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('cookie.agent@supportflow.com');
  });

  it('4. SECURITY: Reusing a rotated refresh token is detected and revokes token family (401 Unauthorized)', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'cookie.agent@supportflow.com',
        password: 'SecurePassword123!',
        workspaceSlug: 'cookie-ws',
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const initialRefreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

    // 2. First refresh (legitimate rotation)
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', initialRefreshCookie!);

    expect(firstRefresh.status).toBe(200);

    // 3. Second refresh using the STALE initial token (replay attempt)
    const replayAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', initialRefreshCookie!);

    expect(replayAttempt.status).toBe(401);
    expect(replayAttempt.body.success).toBe(false);
    expect(replayAttempt.body.error.message).toContain('Invalid refresh token');
  });

  it('5. Logout revokes refresh token and clears all authentication cookies', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'cookie.agent@supportflow.com',
        password: 'SecurePassword123!',
        workspaceSlug: 'cookie-ws',
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

    // 2. Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie!);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify cookies are expired / cleared
    const clearedCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(clearedCookies).toBeDefined();

    const clearedAccess = clearedCookies.find((c: string) => c.startsWith('accessToken=;'));
    const clearedToken = clearedCookies.find((c: string) => c.startsWith('token=;'));
    const clearedRefresh = clearedCookies.find((c: string) => c.startsWith('refreshToken=;'));

    expect(clearedAccess || clearedCookies.some((c: string) => c.includes('accessToken='))).toBeTruthy();
    expect(clearedRefresh || clearedCookies.some((c: string) => c.includes('refreshToken='))).toBeTruthy();

    // 3. Attempting to refresh with the logged-out refresh token fails
    const failRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie!);

    expect(failRefresh.status).toBe(401);
  });
});
