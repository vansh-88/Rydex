import type { Prisma } from '../../../generated/prisma/client.js';
import type { TransactionType } from '../../../generated/prisma/enums.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as transactionRepository from '../repositories/transactionRepository.js';

export interface RecordOrderInput {
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string;
}

// claude.md §38: "use separate concepts" — Payment (gateway-level attempt)
// and Transaction (business-level record) are always created together, one
// call site, so the two can never drift out of sync.
export async function recordOrder(db: Prisma.TransactionClient, input: RecordOrderInput): Promise<void> {
  await paymentRepository.create(db, {
    userId: input.userId,
    bookingId: input.bookingId,
    rideId: input.rideId,
    provider: input.provider,
    providerOrderId: input.providerOrderId,
    amount: input.amount,
    currency: input.currency,
  });

  await transactionRepository.create(db, {
    userId: input.userId,
    bookingId: input.bookingId,
    rideId: input.rideId,
    type: input.type,
    amount: input.amount,
    provider: input.provider,
    providerReference: input.providerOrderId,
  });
}

export type PaymentOutcome = 'SUCCESS' | 'FAILED';

export type ResolvePaymentResult =
  | { kind: 'not_found' }
  | { kind: 'already_resolved' }
  | { kind: 'resolved'; transactionType: TransactionType; rideId: string | null; bookingId: string | null };

// claude.md §40: called from inside the webhook's DB transaction. Resolves
// both the Payment and its associated Transaction together; `not_found` vs
// `already_resolved` let the caller (webhookService) distinguish "retry
// might help" (payment row not written yet — a real race, see
// paymentRecordService.recordOrder's caller ordering) from "nothing left to
// do" (duplicate webhook delivery, §40's idempotency requirement).
export async function resolvePaymentByOrderId(
  db: Prisma.TransactionClient,
  providerOrderId: string,
  outcome: PaymentOutcome,
  providerPaymentId: string,
): Promise<ResolvePaymentResult> {
  const payment = await paymentRepository.findByProviderOrderId(db, providerOrderId);
  if (!payment) {
    return { kind: 'not_found' };
  }
  if (payment.status !== 'CREATED') {
    return { kind: 'already_resolved' };
  }

  const applied = await paymentRepository.resolve(db, payment.id, outcome, providerPaymentId);
  if (!applied) {
    // Lost a race with another resolution of the same payment.
    return { kind: 'already_resolved' };
  }

  const transaction = await transactionRepository.resolveLatestPending(
    db,
    { userId: payment.userId, bookingId: payment.bookingId, rideId: payment.rideId },
    outcome,
  );

  return { kind: 'resolved', transactionType: transaction.type, rideId: payment.rideId, bookingId: payment.bookingId };
}
