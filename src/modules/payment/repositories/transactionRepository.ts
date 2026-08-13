import type { Prisma } from '../../../generated/prisma/client.js';
import type { TransactionStatus, TransactionType } from '../../../generated/prisma/enums.js';

export interface CreateTransactionInput {
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  type: TransactionType;
  amount: number;
  provider: string;
  // Nullable: a REFUND transaction (Phase 11, claude.md §31/§34/§59) is
  // created with no provider reference yet — the actual refund id only
  // exists once refundService.processRefund actually calls
  // PaymentProvider.refund(), after the transaction that created this row
  // has already committed (§5.5).
  providerReference: string | null;
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

// claude.md §59 (Phase 11): refundService reads a REFUND transaction to find
// which booking/ride it's against before calling PaymentProvider.refund().
export async function findById(db: Prisma.TransactionClient, id: string): Promise<TransactionRecord | null> {
  const transaction = await db.transaction.findUnique({ where: { id } });
  return transaction ? toTransactionRecord(transaction) : null;
}

// claude.md §40/§58 pattern reused for refunds: only ever transitions from
// PENDING, so a duplicate/retried refund job is a harmless no-op once the
// first attempt already succeeded — refundService checks this status before
// ever calling PaymentProvider.refund() a second time.
export async function resolveById(
  db: Prisma.TransactionClient,
  id: string,
  status: Extract<TransactionStatus, 'SUCCESS' | 'FAILED'>,
  providerReference: string,
): Promise<boolean> {
  const result = await db.transaction.updateMany({
    where: { id, status: 'PENDING' },
    data: { status, providerReference },
  });
  return result.count === 1;
}
