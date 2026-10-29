import { createSlaWorker, scanAllActiveTicketsSLA } from './slaWorker';
import { createNotificationWorker } from './notificationWorker';
import { connectDatabase, closeDatabase } from '../config/db';
import { closeQueues } from '../jobs/queues';
import { closeRedisConnection } from '../shared/redis';

let isRunning = false;
let slaWorker: any = null;
let notificationWorker: any = null;
let scanInterval: NodeJS.Timeout | null = null;

export const startWorkers = async (): Promise<void> => {
  if (isRunning) return;
  isRunning = true;

  try {
    slaWorker = createSlaWorker();
    notificationWorker = createNotificationWorker();

    console.log('[Workers] ⚙️ SLA and Notification workers initialized successfully.');

    // Periodic SLA deadline scanner (every 30 seconds)
    scanInterval = setInterval(async () => {
      try {
        await scanAllActiveTicketsSLA();
      } catch (err: any) {
        console.error('[Workers] SLA periodic scan error:', err.message);
      }
    }, 30000);
  } catch (err: any) {
    console.warn('[Workers] Worker initialization notice:', err.message);
  }
};

export const stopWorkers = async (): Promise<void> => {
  if (!isRunning) return;
  isRunning = false;

  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  if (slaWorker) {
    await slaWorker.close();
    slaWorker = null;
  }

  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }

  await closeQueues();
  await closeRedisConnection();

  console.log('[Workers] 🛑 Workers stopped gracefully.');
};

// If executed directly via CLI (e.g. node dist/workers/index.js or tsx src/workers/index.ts)
if (require.main === module) {
  (async () => {
    console.log('[Workers] Starting standalone worker process...');
    await connectDatabase();
    await startWorkers();

    const shutdown = async () => {
      console.log('\n[Workers] Shutting down worker process...');
      await stopWorkers();
      await closeDatabase();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })();
}
