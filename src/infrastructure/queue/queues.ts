import { Queue } from 'bullmq';

import { queueConnection } from './connection.js';

// claude.md §43: "Start with only the queues actually needed" — this is the
// first and, for now, only one.
export const BOOKING_EXPIRY_QUEUE_NAME = 'booking-expiry';

export const bookingExpiryQueue = new Queue(BOOKING_EXPIRY_QUEUE_NAME, { connection: queueConnection });
