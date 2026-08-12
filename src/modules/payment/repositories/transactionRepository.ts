import type { Prisma } from '../../../generated/prisma/client.js';
import type { TransactionStatus, TransactionType } from '../../../generated/prisma/enums.js';

export interface CreateTransactionInput {
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  type: TransactionType;
  amount: number;
  provider: string;
  providerReference: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  type: TransactionType;
  amount: number;
  provider: string;
  providerReference: string | null;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toTransactionRecord(row: {
  id: string;
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  type: TransactionType;
  amount: Prisma.Decimal;
  provider: string;
  providerReference: string | null;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}): TransactionRecord {
  return { ...row, amount: row.amount.toNumber() };
}

// claude.md §38: "financial history/reconciliation record... not a wallet."
// Created alongside its Payment row (§97 2026-08-13) with status PENDING, so
// failed attempts are recorded too, not just successes.
export async function create(db: Prisma.TransactionClient, input: CreateTransactionInput): Promise<TransactionRecord> {
  const transaction = await db.transaction.create({ data: { ...input, status: 'PENDING' } });
  return toTransactionRecord(transaction);
}

// There's at most one PENDING transaction per (userId, bookingId, rideId) at
// a time in this phase's scope (one posting-fee or one prepayment per
// entity) — Phase 11's FINAL_PAYMENT/REFUND will create further ones later,
// each resolved the same way at the time it's the live pending one.
export async function resolveLatestPending(
  db: Prisma.TransactionClient,
  where: { userId: string; bookingId: string | null; rideId: string | null },
  status: Extract<TransactionStatus, 'SUCCESS' | 'FAILED'>,
): Promise<TransactionRecord> {
  const pending = await db.transaction.findFirst({
    where: { userId: where.userId, bookingId: where.bookingId, rideId: where.rideId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  if (!pending) {
    throw new Error(`No pending transaction found to resolve for user ${where.userId}`);
  }

  const updated = await db.transaction.update({ where: { id: pending.id }, data: { status } });
  return toTransactionRecord(updated);
}
