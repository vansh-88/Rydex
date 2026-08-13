import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { RegisterDeviceInput } from '../schemas/notificationSchemas.js';
import * as notificationService from '../services/notificationService.js';

// Mounted on userRouter as POST /users/me/devices — claude.md §45's device
// registration lives under the user's own profile management, same
// cross-module routing pattern as bookingController mounted on rideRouter
// (routing is the only thing crossing the module boundary).
export const register: RequestHandler<unknown, unknown, RegisterDeviceInput> = async (req, res) => {
  await notificationService.registerDevice(req.user!.id, req.body.deviceToken, req.body.platform);
  sendSuccess(res, { registered: true }, 201);
};
