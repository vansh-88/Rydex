import type { Express } from 'express';

import { authRouter } from '../modules/auth/routes.js';
import { healthRouter } from './routes/health.routes.js';

export function registerRoutes(app: Express): void {
  app.use(healthRouter);
  app.use('/api/v1/auth', authRouter);
}
