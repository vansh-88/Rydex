import type { Express } from 'express';

import { adminRouter } from '../modules/admin/routes.js';
import { authRouter } from '../modules/auth/routes.js';
import { userRouter } from '../modules/user/routes.js';
import { vehicleRouter } from '../modules/vehicle/routes.js';
import { healthRouter } from './routes/health.routes.js';

export function registerRoutes(app: Express): void {
  app.use(healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/vehicles', vehicleRouter);
}
