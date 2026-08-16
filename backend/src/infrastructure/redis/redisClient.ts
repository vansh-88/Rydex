import { Redis } from 'ioredis';

import { env } from '../../config/env.js';

// ioredis defaults to `enableOfflineQueue: true`, which buffers commands
// issued while the connection is down and flushes them on reconnect. Without
// a deadline that means a command issued during a Redis outage never settles
// — it *hangs* rather than failing, and no try/catch can rescue a hang.
//
// The rate limiter already races its own 1s deadline for this reason, but
// every other caller inherited the hang: `/ready` blocked instead of
// reporting 503 (the readiness probe failing exactly when readiness matters),
// and each OTP request held a connection open for the duration of the outage.
//
// `commandTimeout` fixes it centrally: commands reject once exceeded, so
// every call site's existing error handling actually runs. Turning the
// offline queue off entirely would be the wrong fix — it also breaks the
// brief, normal reconnect window, and OTP storage must fail closed with a
// real error rather than silently proceed.
//
// BullMQ is unaffected: it uses its own connection (infrastructure/queue/
// connection.ts) with `maxRetriesPerRequest: null`, because its blocking
// commands are *supposed* to wait.
//
// Not in claude.md §63's configurable list, so a constant — same reasoning as
// RATE_LIMIT_TIMEOUT_MS.
const REDIS_COMMAND_TIMEOUT_MS = 2000;
const REDIS_CONNECT_TIMEOUT_MS = 5000;

// Cached on `globalThis` so `tsx watch` hot-reloads reuse one connection
// instead of opening a fresh one on every reload (same pattern as prismaClient).
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
  });

// An idle ioredis client emits 'error' on a dropped connection; with no
// listener attached that becomes an unhandled 'error' event and takes the
// process down over a recoverable blip.
redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message);
});

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
