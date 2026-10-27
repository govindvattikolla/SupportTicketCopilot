import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { verifyToken } from '../modules/auth/auth.service';
import { User, UserRole } from '../modules/users/user.model';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Fallback to HTTP-only cookie
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required to access this resource');
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    req.user = {
      _id: user._id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    req.workspaceId = user.workspaceId;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    next();
  };
};
