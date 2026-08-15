import { createServer } from 'node:http';

import { createApp } from './app/app.js';
import { env } from './config/env.js';
import { prisma } from './infrastructure/database/prismaClient.js';
import { bookingExpiryWorker } from './infrastructure/queue/bookingExpiryWorker.js';
import { queueConnection } from './infrastructure/queue/connection.js';
import { notificationWorker } from './infrastructure/queue/notificationWorker.js';
import { bookingExpiryQueue, notificationQueue, refundQueue } from './infrastructure/queue/queues.js';
import { refundWorker } from './infrastructure/queue/refundWorker.js';
import { redis } from './infrastructure/redis/redisClient.js';
import { createSocketServer } from './infrastructure/socket/socketServer.js';
import { registerChatGateway } from './modules/chat/socket/chatGateway.js';

const app = createApp();
// claude.md §47/Phase 13: chat needs a real http.Server to attach Socket.IO
// to (Express's app.listen() creates one internally but doesn't expose it),
// so the server is created explicitly here and both HTTP and WebSocket
// traffic share the same port.
const httpServer = createServer(app);

const io = createSocketServer(httpServer);
registerChatGateway(io);

// Nothing may keep the process alive forever. If a keep-alive connection or a
// worker mid-job refuses to settle, exit anyway rather than hang until the
// platform SIGKILLs us with jobs half-finished.
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

const server = httpServer.listen(env.PORT, () => {
  console.log(`Rydex backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// EADDRINUSE (and friends) arrive as an 'error' event, not a throw. Without a
// listener that is an unhandled 'error' and a raw stack trace.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Is another instance running?`);
  } else {
    console.error('HTTP server error:', err);
  }
  process.exit(1);
});

async function closeResources(): Promise<void> {
  // Workers first, so in-flight jobs finish before the connections they
  // depend on are torn out from under them.
  await Promise.all([bookingExpiryWorker.close(), refundWorker.close(), notificationWorker.close()]);
  await Promise.all([bookingExpiryQueue.close(), refundQueue.close(), notificationQueue.close()]);
  await io.close();
  // Previously nothing disconnected these: the pool and both Redis clients
  // were left for process exit to reap, which drops connections mid-flight
  // rather than draining them.
  await Promise.all([prisma.$disconnect(), redis.quit(), queueConnection.quit()]);
}

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down`);

  const forceExit = setTimeout(() => {
    console.error(`Shutdown did not complete within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((err) => {
    if (err !== undefined) {
      console.error('Error closing HTTP server:', err);
    }

    closeResources()
      .then(() => {
        clearTimeout(forceExit);
        process.exit(err === undefined ? 0 : 1);
      })
      .catch((closeErr: unknown) => {
        console.error('Error releasing resources during shutdown:', closeErr);
        clearTimeout(forceExit);
        process.exit(1);
      });
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

// Neither of these existed. An unhandled rejection anywhere — a worker, a
// socket handler — terminates the process under Node's default behaviour with
// nothing but a bare stack trace, and an operator has no record of what the
// process was doing. Logged explicitly, then the process still exits: the
// state after an unhandled exception is undefined and continuing to serve
// money/seat transitions from it is worse than restarting.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection — shutting down:', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — shutting down:', err);
  shutdown('uncaughtException');
});
