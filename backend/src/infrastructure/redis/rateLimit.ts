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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

// INCR and EXPIRE as one atomic step. The previous two-command version could
// leave a key with no TTL if the process died in between — a counter that
// never resets is a permanent lockout for whoever owns that key. Returning
// the TTL alongside the count also gives us a correct Retry-After without a
// third round trip.
const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { current, redis.call('TTL', KEYS[1]) }
`;

// Failing open needs the Redis call to actually *fail*, and with ioredis it
// doesn't: `enableOfflineQueue` (on by default) buffers commands issued while
// the connection is down and flushes them on reconnect, so a rate-limit check
// against a stopped Redis hangs instead of throwing — verified by stopping the
// container mid-request. A try/catch can't rescue that, so the call is raced
// against this deadline. Turning the offline queue off globally would be the
// wrong fix: OTP storage shares this connection and should fail closed, not
// quietly proceed.
//
// Not in claude.md §63's configurable list, so it stays a constant — same
// reasoning as MAX_DOCUMENT_SIZE_BYTES in middleware/uploadDocument.ts.
const RATE_LIMIT_TIMEOUT_MS = 1000;

const TIMED_OUT = Symbol('rate-limit-timeout');

async function withTimeout<T>(operation: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), RATE_LIMIT_TIMEOUT_MS);
    // Don't hold the event loop open on shutdown just for a pending check.
    timer.unref();
  });

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consumes one unit from a fixed window.
 *
 * Fails open: if Redis is unreachable the call is allowed through. A Redis
 * outage must degrade rate limiting, never take down auth/rides/bookings
 * with it — the same availability-over-strictness trade-off
 * `createPushProvider()` makes for a bad FCM credential (claude.md §97,
 * 2026-08-15). The failure is logged so the unprotected window is visible
 * rather than silent.
 *
 * Exported so non-HTTP callers (the Socket.IO gateway, claude.md §49's
 * "WebSocket connection" category) can share one limiter implementation
 * instead of growing a second one.
 */
export async function consumeRateLimit(
  keyPrefix: string,
  identifier: string,
  windowSeconds: number,
  max: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${keyPrefix}:${identifier}`;

  try {
    const outcome = await withTimeout(
      redis.eval(CONSUME_SCRIPT, 1, key, String(windowSeconds)),
    );

    if (outcome === TIMED_OUT) {
      console.error(`Rate limit check timed out for ${key}; allowing request`);
      return { allowed: true, remaining: max, resetSeconds: windowSeconds };
    }

    const [count, ttl] = outcome as [number, number];

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      // TTL is -1 (no expiry) or -2 (no key) only in races the script above
      // rules out, but clamp anyway so Retry-After is never negative.
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (err) {
    console.error(`Rate limit check failed for ${key}; allowing request:`, err);
    return { allowed: true, remaining: max, resetSeconds: windowSeconds };
  }
}

// Fixed-window counter (claude.md §49).
export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const result = await consumeRateLimit(
      options.keyPrefix,
      options.keyFn(req),
      options.windowSeconds,
      options.max,
    );

    res.setHeader('RateLimit-Limit', options.max);
    res.setHeader('RateLimit-Remaining', result.remaining);
    res.setHeader('RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      // Without Retry-After a client can only guess when to retry, and
      // guessing usually means retrying immediately and staying limited.
      res.setHeader('Retry-After', result.resetSeconds);
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
