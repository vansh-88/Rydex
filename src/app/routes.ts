import type { Express } from 'express';

import { healthRouter } from './routes/health.routes.js';

export function registerRoutes(app: Express): void {
  app.use(healthRouter);
}
