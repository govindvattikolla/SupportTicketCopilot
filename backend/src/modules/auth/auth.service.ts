import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User, IUser, UserRole } from '../users/user.model';
import { Workspace } from '../workspaces/workspace.model';
import { env } from '../../config/env';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/AppError';

export interface TokenPayload {
  userId: string;
  workspaceId: string;
  email: string;
  role: UserRole;
}

export const generateToken = (user: IUser): string => {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    workspaceId: user.workspaceId.toString(),
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};

export const loginUser = async (
  email: string,
  password: string,
  workspaceSlug?: string
): Promise<{ user: Partial<IUser>; token: string }> => {
  // If workspaceSlug is provided, scope to that workspace, otherwise find user by email
  let workspaceId: Types.ObjectId | undefined;
  if (workspaceSlug) {
    const workspace = await Workspace.findOne({ slug: workspaceSlug.toLowerCase().trim() });
    if (!workspace) {
      throw new NotFoundError(`Workspace '${workspaceSlug}' not found`);
    }
    workspaceId = workspace._id;
  }

  const query: any = { email: email.toLowerCase().trim() };
  if (workspaceId) {
    query.workspaceId = workspaceId;
  }

  // Include passwordHash explicitly since it has select: false
  const user = await User.findOne(query).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);

  return {
    user: {
      _id: user._id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
};
