import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../shared/errors/AppError.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
      requestId,
    });
    return;
  }

  // No logging infra wired up yet — this keeps unexpected 500s from being silent during local dev.
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    requestId,
  });
}
