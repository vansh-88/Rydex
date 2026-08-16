import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/AppError.js';
import { sendSuccess } from '../../../shared/http/response.js';
import * as webhookService from '../services/webhookService.js';

const RAZORPAY_SIGNATURE_HEADER = 'x-razorpay-signature';

// No `authenticate` middleware — the caller is Razorpay's servers, not a
// Rydex user. Signature verification (inside webhookService) is the only
// authentication this endpoint has, exactly as claude.md §40 describes.
export const handlePaymentWebhook: RequestHandler = async (req, res) => {
  const signature = req.header(RAZORPAY_SIGNATURE_HEADER);

  // express.json()'s `verify` hook only runs for a JSON content type, so a
  // request sent as anything else leaves rawBody unset. This was a non-null
  // assertion, which made that case a TypeError and a generic 500 on the
  // *one* unauthenticated endpoint in the app — checked explicitly so it
  // answers as the bad request it is.
  if (req.rawBody === undefined) {
    throw new AppError(
      400,
      'INVALID_WEBHOOK_PAYLOAD',
      'Webhook body must be sent with Content-Type: application/json',
    );
  }

  await webhookService.processPaymentWebhook(req.rawBody, signature);
  sendSuccess(res, { received: true });
};
