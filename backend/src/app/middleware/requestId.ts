import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers['x-request-id'];
  const id = typeof existing === 'string' && existing.length > 0 ? existing : `req_${randomUUID()}`;
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
