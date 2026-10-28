import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User, UserRole } from './user.model';
import { AuditEvent } from '../audit/audit.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../../shared/errors/AppError';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['admin', 'lead', 'agent']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'lead', 'agent']).optional(),
  isActive: z.boolean().optional(),
});

export const getWorkspaceUsers = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');

  const users = await User.find({ workspaceId: req.workspaceId })
    .select('_id name email role isActive createdAt updatedAt')
    .sort({ createdAt: -1 });

  return sendSuccess(res, users, 'Workspace team members retrieved');
};

export const createWorkspaceUser = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');

  const { name, email, password, role } = createUserSchema.parse(req.body);

  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user with same email in this workspace
  const existing = await User.findOne({
    workspaceId: req.workspaceId,
    email: normalizedEmail,
  });

  if (existing) {
    throw new BadRequestError('A team member with this email already exists in this workspace');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    workspaceId: req.workspaceId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    isActive: true,
  });

  // Record audit log
  await AuditEvent.create({
    ticketId: newUser._id,
    workspaceId: req.workspaceId,
    actor: {
      type: 'user',
      userId: req.user._id,
      name: req.user.name,
    },
    action: 'team_member_created',
    details: {
      newUserId: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });

  const responseUser = {
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
    createdAt: newUser.createdAt,
  };

  return sendSuccess(res, responseUser, 'Team member added successfully', 201);
};

export const updateWorkspaceUser = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestError('Invalid user ID');
  }

  const user = await User.findOne({ _id: id, workspaceId: req.workspaceId });
  if (!user) {
    throw new NotFoundError('Team member not found in this workspace');
  }

  const { name, role, isActive } = updateUserSchema.parse(req.body);

  // Safeguard: Do not allow an admin to deactivate themselves
  if (isActive === false && req.user._id.toString() === user._id.toString()) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  // Safeguard: Do not allow demoting the last active admin
  if (role && role !== 'admin' && user.role === 'admin') {
    const activeAdminCount = await User.countDocuments({
      workspaceId: req.workspaceId,
      role: 'admin',
      isActive: true,
    });
    if (activeAdminCount <= 1) {
      throw new ForbiddenError('Cannot change role: Workspace must retain at least one active administrator');
    }
  }

  const previousState = {
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };

  if (name !== undefined) user.name = name.trim();
  if (role !== undefined) user.role = role as UserRole;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  // Record audit event
  await AuditEvent.create({
    ticketId: user._id,
    workspaceId: req.workspaceId,
    actor: {
      type: 'user',
      userId: req.user._id,
      name: req.user.name,
    },
    action: 'team_member_updated',
    details: {
      targetUserId: user._id,
      from: previousState,
      to: { name: user.name, role: user.role, isActive: user.isActive },
    },
  });

  const responseUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    updatedAt: user.updatedAt,
  };

  return sendSuccess(res, responseUser, 'Team member updated successfully');
};
