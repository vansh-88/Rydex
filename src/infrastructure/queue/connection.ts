import { Redis } from 'ioredis';

import { env } from '../../config/env.js';

// BullMQ requires `maxRetriesPerRequest: null` on any connection it manages
// (its blocking commands rely on unbounded retries) — must be a separate
// connection from the general-purpose `redis` client (infrastructure/redis),
// which doesn't set this and is used for OTP/rate-limiting instead.
//
// Every Worker additionally needs a connection *of its own*. A Worker sits in a
// blocking BZPOPMIN/BRPOPLPUSH waiting for its next job, and blocking commands
// monopolise the socket they're issued on, so several Workers sharing one
// connection contend for it. That works while the connection is healthy, which
// is why it went unnoticed — but after a Redis outage long enough to drop the
// socket, at least one Worker's blocking loop never resumes. It reports
// `isRunning() === true` and emits no error, while its queue silently fills up
// (reproduced: three Workers on one connection, 25s outage, one queue left with
// wait=1/active=0 permanently; only a process restart recovered it). Seat-hold
// expiry, refunds, and notifications all stop dead in that state.
//
// Queues are unaffected — their commands are ordinary request/response — so
// they still share one connection.
const globalForQueueRedis = globalThis as unknown as { queueRedisPool?: Redis[] };

// Tracked so shutdown can close every connection, and so a `tsx watch` reload
// reuses the existing pool instead of leaking a new set of sockets each time.
const pool: Redis[] = globalForQueueRedis.queueRedisPool ?? [];

if (env.NODE_ENV !== 'production') {
  globalForQueueRedis.queueRedisPool = pool;
}

export function createQueueConnection(label: string): Redis {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  // Without a listener an ioredis 'error' becomes an unhandled 'error' event.
  // These fire on every reconnect attempt during an outage, so they are logged
  // at a single line each rather than with a stack.
  connection.on('error', (err: Error) => {
    console.error(`Redis queue connection (${label}) error:`, err.message);
  });

  pool.push(connection);
  return connection;
}

// Shared by the Queue instances only — never by a Worker.
export const queueConnection = createQueueConnection('queues');

// Shared by all three Workers so their polling cost stays uniform and is
// tuned in one place. `connection` is deliberately NOT included — each Worker
// must supply its own (see above).
export const workerPollingOptions = {
  drainDelay: env.QUEUE_DRAIN_DELAY_SECONDS,
  stalledInterval: env.QUEUE_STALLED_INTERVAL_SECONDS * 1000,
} as const;

export async function closeQueueConnections(): Promise<void> {
  await Promise.all(
    pool.map((connection) =>
      // quit() waits for pending replies; if the server is already gone that
      // never resolves, so fall back to dropping the socket.
      connection.quit().catch(() => {
        connection.disconnect();
      }),
    ),
  );
  pool.length = 0;
}
