import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';

import { AppError } from '../../shared/errors/AppError.js';

// Zod issue messages alone don't say which field failed, so a request missing
// four numbers answered "expected number, received undefined" four times over
// with no way to tell which. Prefixing the path makes the response actionable
// for an API consumer without exposing anything internal.
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

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
          formatIssues(result.error),
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
          formatIssues(result.error),
        ),
      );
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Validates route params. Unlike the two above there is nothing to write
 * back — params are always strings and every schema here only asserts a
 * shape, so the validated value is identical to what the handler already
 * reads off `req.params`.
 *
 * Every id in this codebase is a Postgres `@db.Uuid` (prisma/schema.prisma),
 * so an unvalidated malformed id reaches the driver and surfaces as a raw
 * 500 — claude.md §87 "do not expose raw database errors to clients".
 */
// Shared because six modules route on an id param — no single module owns
// this shape, so it lives with the middleware that consumes it rather than
// being redeclared in each module's schemas/.
export const idParamSchema = z.object({ id: z.uuid('Invalid id') });
export const userIdParamSchema = z.object({ userId: z.uuid('Invalid user id') });

export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          formatIssues(result.error),
        ),
      );
      return;
    }

    next();
  };
}
