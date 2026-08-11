import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../shared/errors/AppError.js';
import { redis } from './redisClient.js';

interface RateLimitOptions {
  keyPrefix: string;
  windowSeconds: number;
  max: number;
  code?: string;
  message?: string;
  keyFn: (req: Request) => string;
}

// Fixed-window counter via INCR+EXPIRE (claude.md §49). Good enough for
// this scale; Phase 14 can harden to a Lua script if the INCR/EXPIRE gap
// under heavy concurrency ever matters in practice.
export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = `ratelimit:${options.keyPrefix}:${options.keyFn(req)}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, options.windowSeconds);
    }

    if (count > options.max) {
      next(
        new AppError(
          429,
          options.code ?? 'RATE_LIMITED',
          options.message ?? 'Too many requests. Please try again later.',
        ),
      );
      return;
    }

    next();
  };
}
