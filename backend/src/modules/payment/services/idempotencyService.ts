import { createHash } from 'node:crypto';

import { env } from '../../../config/env.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

const HOUR_MS = 60 * 60 * 1000;

export function hashRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256').update(`${method}:${path}:${JSON.stringify(body)}`).digest('hex');
}

export type ClaimResult =
  | { kind: 'claimed'; id: string }
  | { kind: 'conflict' }
  | { kind: 'in_progress' }
  | { kind: 'replay'; responseStatus: number; responseBody: unknown };

export interface ClaimInput {
  userId: string;
  key: string;
  endpoint: string;
  requestHash: string;
}

// claude.md §39. The unique constraint on (userId, key) is what makes this
// atomic: `createMany`/skipDuplicates relies on the DB constraint itself to
// arbitrate two concurrent requests racing on the same key — only one
// INSERT can win, exactly like the conditional-update pattern used
// elsewhere (§58), just expressed via a uniqueness constraint instead of a
// WHERE guard.
export async function claim(input: ClaimInput): Promise<ClaimResult> {
  const expiresAt = new Date(Date.now() + env.IDEMPOTENCY_KEY_TTL_HOURS * HOUR_MS);

  const created = await prisma.idempotencyKey.createMany({
    data: [{ userId: input.userId, key: input.key, endpoint: input.endpoint, requestHash: input.requestHash, expiresAt }],
    skipDuplicates: true,
  });

  if (created.count === 1) {
    const row = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId: input.userId, key: input.key } },
    });
    return { kind: 'claimed', id: row!.id };
  }

  // Lost the race (or reusing a key from an earlier request) — look at what's there.
  const existing = await prisma.idempotencyKey.findFirst({
    where: { userId: input.userId, key: input.key, expiresAt: { gt: new Date() } },
  });

  if (!existing) {
    // Expired and not yet purged — treat as if it never existed.
    return claim(input);
  }

  if (existing.requestHash !== input.requestHash) {
    return { kind: 'conflict' };
  }

  if (existing.responseStatus === null) {
    return { kind: 'in_progress' };
  }

  return { kind: 'replay', responseStatus: existing.responseStatus, responseBody: existing.responseBody };
}

export async function complete(id: string, responseStatus: number, responseBody: unknown): Promise<void> {
  await prisma.idempotencyKey.update({
    where: { id },
    data: { responseStatus, responseBody: responseBody as Prisma.InputJsonValue },
  });
}
