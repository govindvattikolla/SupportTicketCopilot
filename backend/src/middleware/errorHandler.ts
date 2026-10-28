import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { sendError } from '../shared/utils/apiResponse';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Operational errors (known application errors)
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', formattedErrors);
    return;
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, 'Invalid identifier format', 400, 'INVALID_ID');
    return;
  }

  // Mongoose duplicate key error (code 11000)
  if ((err as any).code === 11000) {
    sendError(res, 'A record with that value already exists', 409, 'DUPLICATE_KEY');
    return;
  }

  // Mongoose connection failure / buffering timeout
  if (
    err.name === 'MongooseError' ||
    err.message?.includes('buffering timed out') ||
    err.message?.includes('ECONNREFUSED')
  ) {
    sendError(
      res,
      'Database connection unavailable. Please check that MongoDB is running and accessible.',
      503,
      'DATABASE_UNAVAILABLE'
    );
    return;
  }

  // Unknown / unhandled system error
  // Log full error internally for debugging without exposing secrets
  console.error('[Unhandled Server Error]:', {
    name: err.name,
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error';

  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
};
