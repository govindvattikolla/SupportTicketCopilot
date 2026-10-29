import { Request, Response } from 'express';
import { z } from 'zod';
import { loginUser, rotateRefreshToken, revokeRefreshToken } from './auth.service';
import { User } from '../users/user.model';
import { Workspace } from '../workspaces/workspace.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { env } from '../../config/env';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  workspaceSlug: z.string().optional(),
});

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const getCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: maxAgeMs,
});

/**
 * Sets secure HTTP-only cookies for Access Token and Refresh Token
 */
const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  // Set short-lived Access Token in HTTP-only cookie
  res.cookie('accessToken', accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  // Backward compatibility alias for legacy tests checking 'token'
  res.cookie('token', accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  // Set long-lived Refresh Token in HTTP-only cookie
  res.cookie('refreshToken', refreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));
};

/**
 * Clears authentication HTTP-only cookies
 */
const clearAuthCookies = (res: Response): void => {
  const clearOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('token', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, workspaceSlug } = loginSchema.parse(req.body);

  const { user, accessToken, refreshToken, token } = await loginUser(
    email,
    password,
    workspaceSlug,
    req.ip,
    req.headers['user-agent']
  );

  // Set HTTP-only cookies (client stores nothing in localStorage)
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(
    res,
    { user, accessToken, token }, // token provided for API/Supertest clients
    'Login successful'
  );
};

export const refresh = async (req: Request, res: Response): Promise<Response> => {
  // Extract refresh token from HTTP-only cookie, or fallback to request body for API clients
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token required');
  }

  const { user, accessToken, refreshToken } = await rotateRefreshToken(
    rawRefreshToken,
    req.ip,
    req.headers['user-agent']
  );

  // Update HTTP-only cookies with new rotated tokens
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(
    res,
    { user, accessToken, token: accessToken },
    'Session refreshed successfully'
  );
};

export const logout = async (req: Request, res: Response): Promise<Response> => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (rawRefreshToken) {
    await revokeRefreshToken(rawRefreshToken);
  }

  clearAuthCookies(res);
  return sendSuccess(res, null, 'Logged out successfully');
};

export const getCurrentUser = async (req: Request, res: Response): Promise<Response> => {
  const workspace = await Workspace.findById(req.user?.workspaceId);
  return sendSuccess(res, {
    user: req.user,
    workspace: workspace
      ? {
          _id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          settings: workspace.settings,
        }
      : null,
  });
};

export const getWorkspaceAgents = async (req: Request, res: Response): Promise<Response> => {
  const agents = await User.find({
    workspaceId: req.workspaceId,
    isActive: true,
  }).select('_id name email role');

  return sendSuccess(res, agents);
};
