import http from 'http';
import { createApp } from './app';
import { connectDatabase, closeDatabase, getDatabaseStatus } from './config/db';
import { env } from './config/env';
import { initSocketServer } from './realtime/socket';
import { startWorkers, stopWorkers } from './workers';

const startServer = async (): Promise<void> => {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.IO with WebSocket and Polling transports
  initSocketServer(server);

  // Attempt database connection
  try {
    await connectDatabase();
  } catch (error: any) {
    console.error('Initial database connection failed. Server will continue with degraded health status.');
  }
  console.log(`[Server] Database connection status: ${getDatabaseStatus()}`);

  // Start background workers (SLA evaluation & notifications)
  try {
    await startWorkers();
  } catch (err: any) {
    console.warn('[Server] Worker startup warning:', err.message);
  }

  server.listen(env.PORT, () => {
    console.log(`
🚀 SupportFlow Backend API is running!
---------------------------------------------
🌍 Environment: ${env.NODE_ENV}
📡 Port:        ${env.PORT}
🔗 URL:         http://localhost:${env.PORT}
🩺 Health:      http://localhost:${env.PORT}/api/health
⚡ Real-Time:   Socket.IO initialized
⚙️  Workers:     SLA & Notifications active
---------------------------------------------
    `);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await stopWorkers();
        await closeDatabase();
        console.log('[Server] Database connections closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during database shutdown:', err);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});
