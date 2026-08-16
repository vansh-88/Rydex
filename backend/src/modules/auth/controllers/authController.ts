import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type {
  LogoutInput,
  RefreshInput,
  RequestOtpInput,
  VerifyOtpInput,
} from '../schemas/authSchemas.js';
import * as authService from '../services/authService.js';

export const requestOtp: RequestHandler<unknown, unknown, RequestOtpInput> = async (req, res) => {
  await authService.requestOtp(req.body.email);
  sendSuccess(res, { message: 'If this email is eligible, a verification code has been sent.' });
};

export const verifyOtp: RequestHandler<unknown, unknown, VerifyOtpInput> = async (req, res) => {
  const session = await authService.verifyOtpAndAuthenticate(req.body);
  sendSuccess(res, session);
};

export const refresh: RequestHandler<unknown, unknown, RefreshInput> = async (req, res) => {
  const session = await authService.refreshSession(req.body.refreshToken);
  sendSuccess(res, session);
};

export const logout: RequestHandler<unknown, unknown, LogoutInput> = async (req, res) => {
  await authService.logout(req.body.refreshToken, req.body.allDevices ?? false);
  sendSuccess(res, { message: 'Logged out.' });
};
