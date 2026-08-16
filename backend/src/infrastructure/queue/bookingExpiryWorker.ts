import { Worker } from 'bullmq';

import { processBookingExpiry } from '../../modules/booking/services/bookingExpiryService.js';
import type { BookingExpiryJobData } from '../../modules/booking/services/bookingExpiryService.js';
import { createQueueConnection, workerPollingOptions } from './connection.js';
import { BOOKING_EXPIRY_QUEUE_NAME } from './queues.js';

export const bookingExpiryWorker = new Worker<BookingExpiryJobData>(
  BOOKING_EXPIRY_QUEUE_NAME,
  async (job) => {
    await processBookingExpiry(job.data.bookingId);
  },
  // Dedicated connection: a Worker's blocking commands must not share a
  // socket with other Workers (see connection.ts).
  { connection: createQueueConnection('booking-expiry-worker'), ...workerPollingOptions },
);

bookingExpiryWorker.on('failed', (job, err) => {
  console.error(`booking-expiry job ${job?.id ?? '(unknown)'} failed:`, err);
});

console.log('Booking expiry worker started');
