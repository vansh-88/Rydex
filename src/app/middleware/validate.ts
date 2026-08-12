import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../../shared/errors/AppError.js';

declare module 'express-serve-static-core' {
  interface Request {
    // Express 5 makes `req.query` a getter-only property, so a validated/
    // coerced query (e.g. string -> number lat/lng) can't be written back
    // onto it — it lands here instead.
    validatedQuery?: unknown;
  }
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          result.error.issues.map((issue) => issue.message).join('; '),
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          result.error.issues.map((issue) => issue.message).join('; '),
        ),
      );
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
