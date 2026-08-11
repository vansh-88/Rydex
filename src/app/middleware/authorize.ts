import type { NextFunction, Request, Response } from 'express';

import type { UserRole } from '../../generated/prisma/enums.js';
import { AppError } from '../../shared/errors/AppError.js';

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user === undefined) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}
