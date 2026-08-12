import { Redis } from 'ioredis';

import { env } from '../../config/env.js';

// BullMQ requires `maxRetriesPerRequest: null` on any connection it manages
// (its blocking commands rely on unbounded retries) — must be a separate
// connection from the general-purpose `redis` client (infrastructure/redis),
// which doesn't set this and is used for OTP/rate-limiting instead.
const globalForQueueRedis = globalThis as unknown as { queueRedis?: Redis };

export const queueConnection =
  globalForQueueRedis.queueRedis ?? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

if (env.NODE_ENV !== 'production') {
  globalForQueueRedis.queueRedis = queueConnection;
}
