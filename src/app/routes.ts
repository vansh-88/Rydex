import type { Express } from 'express';

import { adminRouter } from '../modules/admin/routes.js';
import { authRouter } from '../modules/auth/routes.js';
import { bookingRouter } from '../modules/booking/routes.js';
import { chatRouter } from '../modules/chat/routes.js';
import { notificationRouter } from '../modules/notification/routes.js';
import { webhookRouter } from '../modules/payment/routes.js';
import { rideRouter } from '../modules/ride/routes.js';
import { supportRouter } from '../modules/support/routes.js';
import { userRouter } from '../modules/user/routes.js';
import { vehicleRouter } from '../modules/vehicle/routes.js';
import { healthRouter } from './routes/health.routes.js';

export function registerRoutes(app: Express): void {
  app.use(healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/vehicles', vehicleRouter);
  app.use('/api/v1/rides', rideRouter);
  app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/conversations', chatRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/webhooks', webhookRouter);
  app.use('/api/v1/support', supportRouter);
}
