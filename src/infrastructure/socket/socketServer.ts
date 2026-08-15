import type { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server } from 'socket.io';

import { corsOrigins } from '../../config/env.js';
import { redis } from '../redis/redisClient.js';

const adapterClients: Redis[] = [];

// claude.md §67: "When running multiple backend instances, use Redis-backed
// Socket.IO adapter/backplane" — without this, an event emitted from one
// instance (e.g. this process handles the sender's socket) would never
// reach a recipient's socket connected to a different instance.
// `.duplicate()` opens dedicated connections for pub/sub mode rather than
// reusing the general-purpose `redis` client, which issues normal commands
// concurrently and can't also be put in subscriber mode.
export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // `corsOrigins` (the parsed array), never the raw CORS_ORIGIN string.
    // Passing the string made Socket.IO echo the whole comma-separated list
    // back as a single Access-Control-Allow-Origin value, which is not a
    // legal header — so the moment a second origin was configured, browsers
    // rejected the WebSocket handshake from *every* origin while the Express
    // routes (which already used the array) kept working.
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: false,
    },
  });

  // `commandTimeout` is inherited from the parent client and left in place:
  // SUBSCRIBE/PUBLISH are ordinary request/response commands that complete
  // immediately, and delivered pub/sub messages are pushes rather than command
  // replies, so the deadline never applies to waiting for a message.
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  // An ioredis 'error' with no listener is an unhandled 'error' event. These
  // two were the clients ioredis named in `missing 'error' handler on this
  // Redis client` during a Redis outage.
  pubClient.on('error', (err: Error) => {
    console.error('Redis Socket.IO pub client error:', err.message);
  });
  subClient.on('error', (err: Error) => {
    console.error('Redis Socket.IO sub client error:', err.message);
  });

  adapterClients.push(pubClient, subClient);
  io.adapter(createAdapter(pubClient, subClient));

  return io;
}

// The adapter does not own these connections (they were passed in), so
// `io.close()` leaves them open — they have to be closed explicitly, the same
// way infrastructure/queue/connection.ts closes its pool.
export async function closeSocketRedisClients(): Promise<void> {
  await Promise.all(
    adapterClients.map((client) =>
      client.quit().catch(() => {
        client.disconnect();
      }),
    ),
  );
  adapterClients.length = 0;
}
