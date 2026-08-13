import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../../../config/env.js';
import type { UserRole } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { AppError } from '../../../shared/errors/AppError.js';

// claude.md §10/§11 — recommended lifetimes. Not in the §63 env var list
// (unlike OTP settings, the doc doesn't call these out as configurable),
// so these are fixed constants rather than env vars.
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let payload: unknown;

  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }

  // The `type: 'access'` claim is signed but was never checked — the cast
  // alone asserted a shape TypeScript can't verify at runtime. Nothing else
  // is currently signed with JWT_ACCESS_SECRET (refresh tokens are random
  // hex, not JWTs), so this isn't exploitable today; it's checked so the
  // invariant holds by construction rather than by that happening to stay
  // true if a second token type is ever signed with the same secret.
  if (
    typeof payload !== 'object' ||
    payload === null ||
    (payload as { type?: unknown }).type !== 'access' ||
    typeof (payload as { sub?: unknown }).sub !== 'string'
  ) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }

  return payload as AccessTokenPayload;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export async function issueRefreshToken(
  userId: string,
  deviceId: string | undefined,
): Promise<string> {
  const token = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      deviceId: deviceId ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return token;
}

export interface RotatedSession {
  accessToken: string;
  refreshToken: string;
}

type RotationResult =
  | { kind: 'not-found' }
  | { kind: 'reuse' }
  | { kind: 'expired' }
  | { kind: 'success'; accessToken: string; refreshToken: string };

// claude.md §11: rotation on every refresh, and reuse of an already-revoked
// token is treated as compromise — the whole session (all of that user's
// active refresh tokens) is revoked, not just the presented one.
//
// The revocation writes must be allowed to COMMIT even on the reuse/expired
// paths — throwing inside a Prisma interactive transaction rolls back
// everything written in it, including the revocation itself. So this
// returns a result variant from the transaction and only throws after it
// has committed.
export async function rotateRefreshToken(presentedToken: string): Promise<RotatedSession> {
  const tokenHash = hashRefreshToken(presentedToken);

  const result = await prisma.$transaction(async (tx): Promise<RotationResult> => {
    const existing = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      return { kind: 'not-found' };
    }

    if (existing.revokedAt !== null) {
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: 'reuse' };
    }

    if (existing.expiresAt < new Date()) {
      return { kind: 'expired' };
    }

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const newToken = generateRefreshToken();

    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(newToken),
        deviceId: existing.deviceId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      kind: 'success',
      accessToken: signAccessToken(existing.userId, existing.user.role),
      refreshToken: newToken,
    };
  });

  switch (result.kind) {
    case 'not-found':
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    case 'reuse':
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'Session revoked due to suspicious activity. Please log in again.',
      );
    case 'expired':
      throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Session expired. Please log in again.');
    case 'success':
      return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
}

// Idempotent: revoking an already-revoked or unknown token is a no-op, not
// an error — logout should never fail just because the session is already gone.
export async function revokeRefreshToken(
  presentedToken: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashRefreshToken(presentedToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    return null;
  }

  if (existing.revokedAt === null) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }

  return { userId: existing.userId };
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
