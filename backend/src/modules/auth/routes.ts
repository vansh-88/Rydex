import { Router } from 'express';

import { env } from '../../config/env.js';
import { validateBody } from '../../app/middleware/validate.js';
import { rateLimit } from '../../infrastructure/redis/rateLimit.js';
import * as authController from './controllers/authController.js';
import {
  logoutSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from './schemas/authSchemas.js';

export const authRouter = Router();

const perIp = rateLimit({
  keyPrefix: 'otp-request-ip',
  windowSeconds: env.OTP_REQUEST_IP_WINDOW_SECONDS,
  max: env.OTP_REQUEST_IP_MAX,
  keyFn: (req) => req.ip ?? 'unknown',
});

// A resend cooldown is just a rate limit with max=1 over the cooldown window.
const resendCooldown = rateLimit({
  keyPrefix: 'otp-resend-cooldown',
  windowSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  max: 1,
  code: 'OTP_RESEND_COOLDOWN',
  message: 'Please wait before requesting another code.',
  keyFn: (req) => (req.body as { email?: string }).email ?? 'unknown',
});

const verifyIp = rateLimit({
  keyPrefix: 'otp-verify-ip',
  windowSeconds: env.OTP_VERIFY_IP_WINDOW_SECONDS,
  max: env.OTP_VERIFY_IP_MAX,
  keyFn: (req) => req.ip ?? 'unknown',
});

// steps.md §18 lists "login/auth endpoints" as its own rate-limit category.
// /refresh and /logout are unauthenticated in the middleware sense — they
// carry a refresh token in the body, not a bearer token — so there is no
// req.user to key on and these go per IP. Guards against grinding tokens
// against the rotation/reuse-detection logic.
const refreshIp = rateLimit({
  keyPrefix: 'auth-refresh-ip',
  windowSeconds: env.AUTH_REFRESH_IP_WINDOW_SECONDS,
  max: env.AUTH_REFRESH_IP_MAX,
  keyFn: (req) => req.ip ?? 'unknown',
});

authRouter.post(
  '/request-otp',
  validateBody(requestOtpSchema),
  perIp,
  resendCooldown,
  authController.requestOtp,
);

authRouter.post('/verify-otp', validateBody(verifyOtpSchema), verifyIp, authController.verifyOtp);

authRouter.post('/refresh', refreshIp, validateBody(refreshSchema), authController.refresh);

authRouter.post('/logout', refreshIp, validateBody(logoutSchema), authController.logout);
