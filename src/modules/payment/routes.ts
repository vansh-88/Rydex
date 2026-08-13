import { Router } from 'express';

import { env } from '../../config/env.js';
import { rateLimit } from '../../infrastructure/redis/rateLimit.js';
import { handlePaymentWebhook } from './controllers/webhookController.js';

// claude.md §51: mounted at /api/v1/webhooks/payment (see app/routes.ts) —
// deliberately separate from bookingRouter/rideRouter's /api/v1 root, and
// deliberately not behind `authenticate`.
export const webhookRouter = Router();

// Public and unauthenticated, so keyed per IP. Set deliberately high: this
// is a denial-of-service ceiling, not a business limit. Signature
// verification (claude.md §40) is what actually rejects forged events, and
// rate-limiting a genuine Razorpay retry burst into a 429 would lose real
// payment confirmations — much worse than absorbing the traffic.
const webhookIp = rateLimit({
  keyPrefix: 'webhook-ip',
  windowSeconds: env.WEBHOOK_IP_WINDOW_SECONDS,
  max: env.WEBHOOK_IP_MAX,
  keyFn: (req) => req.ip ?? 'unknown',
});

webhookRouter.post('/payment', webhookIp, handlePaymentWebhook);
