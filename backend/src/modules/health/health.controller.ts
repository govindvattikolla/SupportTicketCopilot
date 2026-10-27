import { Request, Response } from 'express';
import { getDatabaseStatus } from '../../config/db';
import { env } from '../../config/env';
import { sendSuccess } from '../../shared/utils/apiResponse';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  service: string;
  database: {
    status: string;
    healthy: boolean;
  };
}

export const getHealth = (_req: Request, res: Response): Response => {
  const dbStatus = getDatabaseStatus();
  const isDbHealthy = dbStatus === 'connected';
  const overallStatus = isDbHealthy ? 'ok' : 'degraded';

  const healthData: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    service: 'supportflow-api',
    database: {
      status: dbStatus,
      healthy: isDbHealthy,
    },
  };

  const statusCode = isDbHealthy ? 200 : 503;
  return sendSuccess(res, healthData, undefined, statusCode);
};
