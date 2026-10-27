import { Request, Response } from 'express';
import { z } from 'zod';
import { loginUser } from './auth.service';
import { User } from '../users/user.model';
import { Workspace } from '../workspaces/workspace.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { env } from '../../config/env';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  workspaceSlug: z.string().optional(),
});

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, workspaceSlug } = loginSchema.parse(req.body);

  const { user, token } = await loginUser(email, password, workspaceSlug);

  // Set HTTP-only secure cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendSuccess(res, { user, token }, 'Login successful');
};

export const logout = (_req: Request, res: Response): Response => {
  res.clearCookie('token');
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
