import type { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';

import { corsOrigins } from '../../config/env.js';
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

  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  return io;
}
