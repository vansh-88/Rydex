import { Redis } from 'ioredis';

import { env } from '../../config/env.js';

// Cached on `globalThis` so `tsx watch` hot-reloads reuse one connection
// instead of opening a fresh one on every reload (same pattern as prismaClient).
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? new Redis(env.REDIS_URL);

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
