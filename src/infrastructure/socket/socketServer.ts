import type { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';

import { env } from '../../config/env.js';
import { redis } from '../redis/redisClient.js';

// claude.md §67: "When running multiple backend instances, use Redis-backed
// Socket.IO adapter/backplane" — without this, an event emitted from one
// instance (e.g. this process handles the sender's socket) would never
// reach a recipient's socket connected to a different instance.
// `.duplicate()` opens dedicated connections for pub/sub mode rather than
// reusing the general-purpose `redis` client, which issues normal commands
// concurrently and can't also be put in subscriber mode.
export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  return io;
}
