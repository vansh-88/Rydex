import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { paymentProvider } from '../../../infrastructure/payments/index.js';
import { refundQueue } from '../../../infrastructure/queue/queues.js';
import * as notificationService from '../../notification/services/notificationService.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as transactionRepository from '../repositories/transactionRepository.js';

export interface RefundJobData {
  transactionId: string;
}

const PROCESS_REFUND_JOB_NAME = 'process-refund';

// claude.md §43: bounded retry + exponential backoff — a refund call hits a
// real external gateway that can fail transiently, unlike booking-expiry's
// pure-DB job. `jobId: transactionId` gives natural dedup (mirrors
// bookingExpiryService's `jobId: bookingId`).
export async function scheduleRefund(transactionId: string): Promise<void> {
  await refundQueue.add(
    PROCESS_REFUND_JOB_NAME,
    { transactionId } satisfies RefundJobData,
    { jobId: transactionId, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
  );
}

// claude.md §40/§58 idempotency pattern reused for refunds. Loads the
// transaction and short-circuits if it's not PENDING *before* calling the
// provider — closes a crash-then-retry window where the process could die
// after PaymentProvider.refund() succeeds at the gateway but before the DB
// commit; without this check, a BullMQ retry would call refund() a second
// time against the same payment (claude.md §84: "refund cannot exceed
// refundable amount").
export async function processRefund(transactionId: string): Promise<void> {
  const transaction = await transactionRepository.findById(prisma, transactionId);
  if (!transaction || transaction.type !== 'REFUND' || transaction.status !== 'PENDING') {
    return;
  }

  const originalPayment = transaction.bookingId
    ? await paymentRepository.findSuccessfulByBookingId(prisma, transaction.bookingId)
    : transaction.rideId
      ? await paymentRepository.findSuccessfulByRideId(prisma, transaction.rideId)
      : null;

  if (!originalPayment?.providerPaymentId) {
    console.error(`Refund transaction ${transactionId} has no resolvable original captured payment — needs manual review.`);
    return;
  }

  const refund = await paymentProvider.refund({
    providerPaymentId: originalPayment.providerPaymentId,
    amount: transaction.amount,
  });

  await transactionRepository.resolveById(prisma, transactionId, 'SUCCESS', refund.providerRefundId);

  await notificationService.notifyRefundProcessed(transaction.userId, transaction.amount);
}
