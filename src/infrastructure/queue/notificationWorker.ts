import { Worker } from 'bullmq';

import { processNotificationJob } from '../../modules/notification/services/notificationService.js';
import type { NotificationJobData } from '../../modules/notification/services/notificationService.js';
import { createQueueConnection, workerPollingOptions } from './connection.js';
import { NOTIFICATION_QUEUE_NAME } from './queues.js';

export const notificationWorker = new Worker<NotificationJobData>(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    await processNotificationJob(job.data);
  },
  // Dedicated connection: a Worker's blocking commands must not share a
  // socket with other Workers (see connection.ts).
  { connection: createQueueConnection('notification-worker'), ...workerPollingOptions },
);

notificationWorker.on('failed', (job, err) => {
  console.error(`notification job ${job?.id ?? '(unknown)'} failed:`, err);
});

console.log('Notification worker started');
