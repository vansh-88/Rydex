import { Worker } from 'bullmq';

import { processRefund } from '../../modules/payment/services/refundService.js';
import type { RefundJobData } from '../../modules/payment/services/refundService.js';
import { createQueueConnection } from './connection.js';
import { REFUND_QUEUE_NAME } from './queues.js';

export const refundWorker = new Worker<RefundJobData>(
  REFUND_QUEUE_NAME,
  async (job) => {
    await processRefund(job.data.transactionId);
  },
  // Dedicated connection: a Worker's blocking commands must not share a
  // socket with other Workers (see connection.ts).
  { connection: createQueueConnection('refund-worker') },
);

refundWorker.on('failed', (job, err) => {
  console.error(`refund job ${job?.id ?? '(unknown)'} failed:`, err);
});

console.log('Refund worker started');
