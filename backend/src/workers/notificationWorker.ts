import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisClient } from '../shared/redis';
import { NOTIFICATION_QUEUE_NAME } from '../jobs/queues';
import { createAndDispatchNotification } from '../modules/notifications/notification.service';

export const createNotificationWorker = (): Worker => {
  const connection = getRedisClient();
  const worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'dispatch-notification') {
        const {
          workspaceId,
          userId,
          type,
          title,
          message,
          ticketId,
          ticketNumber,
          sendEmail,
          metadata,
        } = job.data;

        await createAndDispatchNotification({
          workspaceId: new Types.ObjectId(workspaceId),
          userId: new Types.ObjectId(userId),
          type,
          title,
          message,
          ticketId: ticketId ? new Types.ObjectId(ticketId) : undefined,
          ticketNumber,
          sendEmail,
          metadata,
        });
      }
    },
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
