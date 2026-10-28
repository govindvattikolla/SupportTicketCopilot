import { Response } from 'express';

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response => {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
  };
  return res.status(statusCode).json(payload);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string
): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errorCode?: string,
  details?: unknown
): Response => {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      message,
      ...(errorCode ? { code: errorCode } : {}),
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(payload);
};
