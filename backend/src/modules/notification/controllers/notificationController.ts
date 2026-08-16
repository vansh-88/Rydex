import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { ListNotificationsQuery } from '../schemas/notificationSchemas.js';
import * as notificationService from '../services/notificationService.js';

// Query is validated/coerced by validateQuery(listNotificationsQuerySchema)
// into req.validatedQuery (see app/middleware/validate.ts / rideController
// for the same pattern — Express 5's req.query has no setter).
export const list: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as ListNotificationsQuery;
  const result = await notificationService.listNotifications(req.user!.id, query.cursor, query.limit);
  sendSuccess(res, result);
};

export const markRead: RequestHandler<{ id: string }> = async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.user!.id, req.params.id);
  sendSuccess(res, notification);
};
