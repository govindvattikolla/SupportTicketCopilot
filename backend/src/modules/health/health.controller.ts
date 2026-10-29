import { Request, Response } from 'express';
import { getDatabaseStatus } from '../../config/db';
import { env } from '../../config/env';
import { isMockRedis } from '../../shared/redis';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  service: string;
  version: string;
  database: {
    status: string;
    healthy: boolean;
  };
  redis: {
    mode: 'redis' | 'in-memory-mock';
    healthy: boolean;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

/**
 * Full system health diagnostics endpoint
 * GET /api/health
 */
export const getHealth = (_req: Request, res: Response): Response => {
  const dbStatus = getDatabaseStatus();
  const isDbHealthy = dbStatus === 'connected';
  const overallStatus = isDbHealthy ? 'ok' : 'degraded';

  const memoryUsage = process.memoryUsage();

  const healthData: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    service: 'supportflow-api',
    version: '0.1.0',
    database: {
      status: dbStatus,
      healthy: isDbHealthy,
    },
    redis: {
      mode: isMockRedis() ? 'in-memory-mock' : 'redis',
      healthy: true,
    },
    memory: {
      heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
    },
  };

  const statusCode = isDbHealthy ? 200 : 503;
  return sendSuccess(res, healthData, undefined, statusCode);
};

/**
 * Lightweight liveness probe for Kubernetes / cloud container orchestrators
 * GET /api/health/live
 */
export const getLiveness = (_req: Request, res: Response): Response => {
  return sendSuccess(res, {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
};

/**
 * Readiness probe verifying DB readiness before routing traffic
 * GET /api/health/ready
 */
export const getReadiness = (_req: Request, res: Response): Response => {
  const dbStatus = getDatabaseStatus();
  const isReady = dbStatus === 'connected';

  if (!isReady) {
    return sendError(
      res,
      'Service not ready: Database connection is not established',
      503,
      'SERVICE_UNAVAILABLE'
    );
  }

  return sendSuccess(res, {
    status: 'ready',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
};
