import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { UpdateProfileInput } from '../schemas/userSchemas.js';
import * as userService from '../services/userService.js';

export const getMe: RequestHandler = async (req, res) => {
  const profile = await userService.getProfile(req.user!.id);
  sendSuccess(res, profile);
};

export const updateMe: RequestHandler<unknown, unknown, UpdateProfileInput> = async (
  req,
  res,
) => {
  const profile = await userService.updateProfile(req.user!.id, req.body);
  sendSuccess(res, profile);
};
