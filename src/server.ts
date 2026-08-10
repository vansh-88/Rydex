import { createApp } from './app/app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Rydex backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down`);
  server.close((err) => {
    if (err !== undefined) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
