import type { NextFunction, Request, Response } from 'express';

import * as idempotencyService from '../../modules/payment/services/idempotencyService.js';
import { AppError } from '../../shared/errors/AppError.js';

// claude.md §39: required on payment-producing APIs (ride creation, booking
// creation — the two endpoints that call PaymentProvider.createOrder()).
// Money-creating side effects on a client retry are exactly what this
// exists to prevent, so the header is mandatory here rather than optional.
export function idempotency(endpoint: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (key === undefined || key.length === 0) {
      next(new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required'));
      return;
    }

    const requestHash = idempotencyService.hashRequest(req.method, req.originalUrl, req.body);
    const result = await idempotencyService.claim({ userId: req.user!.id, key, endpoint, requestHash });

    if (result.kind === 'conflict') {
      next(new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different request'));
      return;
    }
    if (result.kind === 'in_progress') {
      next(new AppError(409, 'IDEMPOTENCY_KEY_IN_PROGRESS', 'A request with this Idempotency-Key is still processing'));
      return;
    }
    if (result.kind === 'replay') {
      res.status(result.responseStatus).json(result.responseBody);
      return;
    }

    // result.kind === 'claimed' — run the handler, then persist whatever it
    // sends so a retry with the same key can replay it without re-running
    // side effects.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      idempotencyService.complete(result.id, res.statusCode, body).catch((err: unknown) => {
        console.error(`Failed to persist idempotency response for key ${key}:`, err);
      });
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
