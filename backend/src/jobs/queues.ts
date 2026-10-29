import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient, isMockRedis } from '../shared/redis';

export const SLA_QUEUE_NAME = 'supportflow-sla-queue';
export const NOTIFICATION_QUEUE_NAME = 'supportflow-notification-queue';

let slaQueue: Queue | null = null;
let notificationQueue: Queue | null = null;

const getQueueOptions = (): QueueOptions => {
  const connection = getRedisClient();
  return {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600, // keep for 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400, // keep failed for 24 hours
      },
    },
  };
};

export const getSlaQueue = (): Queue => {
  if (!slaQueue) {
    slaQueue = new Queue(SLA_QUEUE_NAME, getQueueOptions());
  }
  return slaQueue;
};

export const getNotificationQueue = (): Queue => {
  if (!notificationQueue) {
    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, getQueueOptions());
  }
  return notificationQueue;
};

/**
 * Enqueue an SLA deadline check or calculation job with optional deduplication key (jobId)
 */
export const queueSlaCheckJob = async (
  ticketId: string,
  options: { jobId?: string; delayMs?: number } = {}
): Promise<void> => {
  try {
    const queue = getSlaQueue();
    await queue.add(
      'check-ticket-sla',
      { ticketId },
      {
        jobId: options.jobId || `sla-check-${ticketId}-${Date.now()}`,
        delay: options.delayMs || 0,
      }
    );
  } catch (err: any) {
    console.warn('[Queue] Failed to enqueue SLA job via Redis, running safely:', err.message);
  }
};

/**
 * Enqueue an In-App or Email notification job with deduplication key (jobId)
 */
export const queueNotificationJob = async (
  payload: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    ticketId?: string;
    ticketNumber?: string;
    sendEmail?: boolean;
    metadata?: Record<string, any>;
  },
  options: { jobId?: string } = {}
): Promise<void> => {
  try {
    const queue = getNotificationQueue();
    const jobId = options.jobId || `notif-${payload.type}-${payload.ticketId || 'none'}-${payload.userId}-${Date.now()}`;
    await queue.add('dispatch-notification', payload, {
      jobId,
    });
  } catch (err: any) {
    console.warn('[Queue] Failed to enqueue notification job via Redis, running safely:', err.message);
  }
};

export const closeQueues = async (): Promise<void> => {
  if (slaQueue) {
    await slaQueue.close();
    slaQueue = null;
  }
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
};
