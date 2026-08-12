import { Router } from 'express';

import { handlePaymentWebhook } from './controllers/webhookController.js';

// claude.md §51: mounted at /api/v1/webhooks/payment (see app/routes.ts) —
// deliberately separate from bookingRouter/rideRouter's /api/v1 root, and
// deliberately not behind `authenticate`.
export const webhookRouter = Router();

webhookRouter.post('/payment', handlePaymentWebhook);
