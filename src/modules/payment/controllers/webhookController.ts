import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import * as webhookService from '../services/webhookService.js';

const RAZORPAY_SIGNATURE_HEADER = 'x-razorpay-signature';

// No `authenticate` middleware — the caller is Razorpay's servers, not a
// Rydex user. Signature verification (inside webhookService) is the only
// authentication this endpoint has, exactly as claude.md §40 describes.
export const handlePaymentWebhook: RequestHandler = async (req, res) => {
  const signature = req.header(RAZORPAY_SIGNATURE_HEADER);
  await webhookService.processPaymentWebhook(req.rawBody!, signature);
  sendSuccess(res, { received: true });
};
