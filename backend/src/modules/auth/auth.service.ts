import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User, IUser, UserRole } from '../users/user.model';
import { Workspace } from '../workspaces/workspace.model';
import { RefreshToken } from './refreshToken.model';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/AppError';

export interface TokenPayload {
  userId: string;
  workspaceId: string;
  email: string;
  role: UserRole;
  type?: 'access' | 'refresh';
}

export interface RefreshTokenPayload {
  userId: string;
  workspaceId: string;
  family: string;
  tokenId: string;
  type: 'refresh';
}

/**
 * Computes deterministic SHA-256 hash of a raw token for database storage and indexing
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates short-lived Access Token (default 15 minutes)
 */
export const generateAccessToken = (user: IUser): string => {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    workspaceId: user.workspaceId.toString(),
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

// Backward-compatibility alias
export const generateToken = generateAccessToken;

/**
 * Generates and stores long-lived Refresh Token (default 7 days) with token rotation metadata
 */
export const generateRefreshToken = async (
  user: IUser,
  family?: string,
  ip?: string,
  userAgent?: string
): Promise<{ refreshToken: string; expiresAt: Date; family: string }> => {
  const tokenFamily = family || crypto.randomUUID();
  const tokenId = crypto.randomUUID();

  const payload: RefreshTokenPayload = {
    userId: user._id.toString(),
    workspaceId: user.workspaceId.toString(),
    family: tokenFamily,
    tokenId,
    type: 'refresh',
  };

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    workspaceId: user.workspaceId,
    tokenHash,
    family: tokenFamily,
    isRevoked: false,
    expiresAt,
    createdByIp: ip,
    userAgent,
  });

  return { refreshToken, expiresAt, family: tokenFamily };
};

/**
 * Verifies short-lived Access Token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};

// Backward-compatibility alias
export const verifyToken = verifyAccessToken;

/**
 * Verifies long-lived Refresh Token JWT
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
};

/**
 * Rotates an active Refresh Token: validates, checks for reuse, revokes old token, and issues a new pair
 */
export const rotateRefreshToken = async (
  rawRefreshToken: string,
  ip?: string,
  userAgent?: string
): Promise<{ user: Partial<IUser>; accessToken: string; refreshToken: string }> => {
  const decoded = verifyRefreshToken(rawRefreshToken);
  const currentHash = hashToken(rawRefreshToken);

  const tokenDoc = await RefreshToken.findOne({ tokenHash: currentHash });

  // REUSE DETECTION: If token was already revoked, someone is replaying a stolen/rotated token!
  if (tokenDoc && tokenDoc.isRevoked) {
    logger.warn(`Security alert: Refresh token reuse detected for user ${decoded.userId}. Revoking family ${tokenDoc.family}`);
    // Invalidate the entire family to protect the user
    await RefreshToken.updateMany({ family: tokenDoc.family }, { isRevoked: true });
    throw new UnauthorizedError('Invalid refresh token. Session revoked for security.');
  }

  if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User account not found or deactivated');
  }

  // Generate new tokens in the same family
  const newAccessToken = generateAccessToken(user);
  const { refreshToken: newRefreshToken } = await generateRefreshToken(user, tokenDoc.family, ip, userAgent);

  // Revoke current token and link to replacement
  tokenDoc.isRevoked = true;
  tokenDoc.replacedByTokenHash = hashToken(newRefreshToken);
  await tokenDoc.save();

  return {
    user: {
      _id: user._id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Revokes a single Refresh Token (e.g. on user logout)
 */
export const revokeRefreshToken = async (rawRefreshToken: string): Promise<void> => {
  try {
    const currentHash = hashToken(rawRefreshToken);
    await RefreshToken.updateOne({ tokenHash: currentHash }, { isRevoked: true });
  } catch (err) {
    logger.debug('Failed to revoke refresh token record', { error: (err as Error).message });
  }
};

/**
 * Revokes all refresh tokens for a user (e.g. password reset or global logout)
 */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await RefreshToken.updateMany({ userId: new Types.ObjectId(userId) }, { isRevoked: true });
};

/**
 * Authenticates user credentials and issues both Access Token and Refresh Token
 */
export const loginUser = async (
  email: string,
  password: string,
  workspaceSlug?: string,
  ip?: string,
  userAgent?: string
): Promise<{ user: Partial<IUser>; accessToken: string; refreshToken: string; token: string }> => {
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

  const accessToken = generateAccessToken(user);
  const { refreshToken } = await generateRefreshToken(user, undefined, ip, userAgent);

  return {
    user: {
      _id: user._id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
    token: accessToken, // Backward-compatibility
  };
};
