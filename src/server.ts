import { createServer } from 'node:http';

import { createApp } from './app/app.js';
import { env } from './config/env.js';
import { bookingExpiryWorker } from './infrastructure/queue/bookingExpiryWorker.js';
import { notificationWorker } from './infrastructure/queue/notificationWorker.js';
import { refundWorker } from './infrastructure/queue/refundWorker.js';
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

const server = httpServer.listen(env.PORT, () => {
  console.log(`Rydex backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down`);
  Promise.all([bookingExpiryWorker.close(), refundWorker.close(), notificationWorker.close(), io.close()])
    .catch((err: unknown) => {
      console.error('Error closing background workers:', err);
    })
    .finally(() => {
      server.close((err) => {
        if (err !== undefined) {
          console.error('Error during shutdown:', err);
          process.exit(1);
        }
        process.exit(0);
      });
    });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
