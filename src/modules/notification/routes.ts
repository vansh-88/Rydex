import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { idParamSchema, validateParams, validateQuery } from '../../app/middleware/validate.js';
import * as notificationController from './controllers/notificationController.js';
import { listNotificationsQuerySchema } from './schemas/notificationSchemas.js';

// claude.md §51: GET /notifications, PATCH /notifications/:id/read.
// POST /users/me/devices lives on userRouter (src/modules/user/routes.ts)
// — see deviceController.ts for why.
export const notificationRouter = Router();

notificationRouter.use(authenticate);

// Scoped to the caller's own notifications in the service layer
// (notificationRepository.listByUser/markRead both filter by userId) — no
// separate authorization rule needed, same reasoning as GET /users/me.
notificationRouter.get('/', validateQuery(listNotificationsQuerySchema), notificationController.list);
notificationRouter.patch(
  '/:id/read',
  validateParams(idParamSchema),
  notificationController.markRead,
);
