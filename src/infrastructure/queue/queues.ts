import { Queue } from 'bullmq';

import { queueConnection } from './connection.js';

// claude.md §43: "Start with only the queues actually needed."
export const BOOKING_EXPIRY_QUEUE_NAME = 'booking-expiry';

export const bookingExpiryQueue = new Queue(BOOKING_EXPIRY_QUEUE_NAME, { connection: queueConnection });

// claude.md §5.5/§43/§59 (Phase 11): refund intents are recorded as PENDING
// Transaction rows inside the same DB transaction that cancels a ride/
// booking, but the actual PaymentProvider.refund() call is an external call
// and must happen outside that transaction — enqueued here so it's
// retryable/idempotent instead of a synchronous call in the request path.
export const REFUND_QUEUE_NAME = 'refund';

export const refundQueue = new Queue(REFUND_QUEUE_NAME, { connection: queueConnection });

// claude.md §42/§43 (Phase 12): "do not block user-facing API requests
// waiting for FCM" — every business-event notification (RideCancelled,
// BookingConfirmed, etc.) is enqueued here rather than delivered inline.
export const NOTIFICATION_QUEUE_NAME = 'notification';

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, { connection: queueConnection });
