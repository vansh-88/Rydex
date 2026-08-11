import type { NextFunction, Request, Response } from 'express';

import type { UserRole } from '../../generated/prisma/enums.js';
import { verifyAccessToken } from '../../modules/auth/services/tokenService.js';
import { AppError } from '../../shared/errors/AppError.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: UserRole };
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (header === undefined || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing bearer token'));
    return;
  }

  const payload = verifyAccessToken(header.slice('Bearer '.length));
  req.user = { id: payload.sub, role: payload.role };
  next();
}
