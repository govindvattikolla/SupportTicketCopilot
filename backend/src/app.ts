import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { publicTicketRoutes } from './modules/tickets/publicTicket.routes';
import { staffTicketRoutes } from './modules/tickets/staffTicket.routes';
import { reportRoutes } from './modules/reports/report.routes';
import { workspaceRoutes } from './modules/workspaces/workspace.routes';
import { userRoutes } from './modules/users/user.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import ticketQueryRoutes from './modules/ticketQueries/ticketQuery.routes';
import adminReportRoutes from './modules/adminReports/adminReport.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import operationsRoutes from './modules/operations/operations.routes';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './shared/errors/AppError';

export const createApp = (): Application => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body & Cookie parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // HTTP request logging (suppressed during automated tests)
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
        stream: logger.morganStream,
      })
    );
  }

  // Global rate limiter for API routes (1000 requests per 15 min per IP)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: 'Too many API requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
  });
  app.use('/api', apiLimiter);

  // API Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public/tickets', publicTicketRoutes);
  app.use('/api/tickets', staffTicketRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/ticket-queries', ticketQueryRoutes);
  app.use('/api/admin-reports', adminReportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/operations', operationsRoutes);

  // 404 Handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
