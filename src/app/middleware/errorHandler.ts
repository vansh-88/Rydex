import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';

import { AppError } from '../../shared/errors/AppError.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// Errors thrown by middleware that runs before any controller — body parsing
// and multipart upload. These arrive as plain Error subclasses carrying their
// own correct HTTP status, which the handler used to discard, answering 500
// for four distinct client mistakes: malformed JSON, an over-large body, an
// over-large upload, and a webhook posted with a non-JSON content type. Beyond
// being wrong for the caller, it made every client error look like a server
// fault in the 5xx rate.
function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) {
    return err;
  }

  // multer: file exceeded DOCUMENT limits, too many parts/files, etc.
  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD';
    return new AppError(status, code, err.message, { cause: err });
  }

  // express.json(): body-parser tags its own failures with a `type` and an
  // HTTP `status`. Matched structurally rather than by class because
  // body-parser throws plain Errors decorated with these fields.
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const { type, status } = err as { type?: unknown; status?: unknown };
    const message = err instanceof Error ? err.message : 'Invalid request body';

    if (type === 'entity.parse.failed') {
      return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON', { cause: err });
    }
    if (type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large', { cause: err });
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return new AppError(status, 'BAD_REQUEST', message, { cause: err });
    }
  }

  return null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;
  const appError = toAppError(err);

  if (appError !== null) {
    // 4xx is the caller's problem and is answered without noise. 5xx is ours:
    // an AppError like EMAIL_SEND_FAILED or PUSH_DELIVERY_FAILED carries the
    // provider's underlying failure on `cause`, and logging it here is the
    // only reason that cause is worth attaching (claude.md §61). Without this,
    // a 502 reached the client with the diagnosis discarded server-side.
    if (appError.statusCode >= 500) {
      console.error(
        `[${requestId ?? 'no-request-id'}] ${req.method} ${req.originalUrl} -> ${appError.statusCode} ${appError.code}`,
        appError.cause ?? appError,
      );
    }

    res.status(appError.statusCode).json({
      success: false,
      error: { code: appError.code, message: appError.message },
      requestId,
    });
    return;
  }

  // Genuinely unexpected — always logged, never detailed to the client.
  console.error(`[${requestId ?? 'no-request-id'}] ${req.method} ${req.originalUrl} -> 500`, err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    requestId,
  });
}
