import { z } from 'zod';

import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { paymentProvider, paymentProviderName } from '../../../infrastructure/payments/index.js';
import * as bookingRepository from '../../booking/repositories/bookingRepository.js';
import { cancelScheduledBookingExpiry } from '../../booking/services/bookingExpiryService.js';
import { calculateSettlement } from '../../booking/services/settlementService.js';
import * as notificationService from '../../notification/services/notificationService.js';
import * as rideRepository from '../../ride/repositories/rideRepository.js';
import { calculateDriverCancellationRefund } from '../../ride/services/cancellationPolicyService.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as transactionRepository from '../repositories/transactionRepository.js';
import * as paymentRecordService from './paymentRecordService.js';
import type { PaymentOutcome } from './paymentRecordService.js';
import { scheduleRefund } from './refundService.js';

// claude.md §40. Deliberately loose — only the fields this handler actually
// needs are validated; unrecognized/extra fields (Razorpay sends plenty) are
// ignored rather than rejected.
const webhookPayloadSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({ id: z.string(), order_id: z.string() }),
        })
        .optional(),
    })
    .optional(),
});

// Only these two are handled — every other Razorpay event (order.paid,
// refund.processed, etc.) is acknowledged with 200 and otherwise ignored,
// standard webhook practice: never make the provider retry an event we
// don't act on.
const OUTCOME_BY_EVENT: Record<string, PaymentOutcome> = {
  'payment.captured': 'SUCCESS',
  'payment.failed': 'FAILED',
};

// claude.md §40 webhook flow: verify signature -> identify transaction ->
// idempotency check -> update payment -> update booking/ride state ->
// enqueue notifications. Notification enqueueing is Phase 12's job (no
// Notification module exists yet) — deliberately not built here; the state
// transition itself is the part that must not silently regress.
export async function processPaymentWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (signature === undefined || !paymentProvider.verifyWebhookSignature(rawBody, signature)) {
    throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook body is not valid JSON');
  }

  const parsed = webhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook body does not match the expected shape');
  }

  const outcome = OUTCOME_BY_EVENT[parsed.data.event];
  if (!outcome) {
    return; // unrecognized/irrelevant event — ack, no-op
  }

  const paymentEntity = parsed.data.payload?.payment?.entity;
  if (!paymentEntity) {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook payload missing payment entity');
  }

  const { resolution, refundTransactionIds, bookingConfirmed } = await prisma.$transaction(async (tx) => {
    const result = await paymentRecordService.resolvePaymentByOrderId(
      tx,
      paymentEntity.order_id,
      outcome,
      paymentEntity.id,
    );

    if (result.kind !== 'resolved') {
      return { resolution: result, refundTransactionIds: [] as string[], bookingConfirmed: false };
    }

    const refundTransactionIds: string[] = [];
    let bookingConfirmed = false;

    if (result.transactionType === 'DRIVER_RIDE_FEE' && result.rideId) {
      if (outcome === 'SUCCESS') {
        const applied = await rideRepository.confirmPayment(tx, result.rideId);
        if (!applied) {
          // The ride left PENDING_PAYMENT some other way — the only other
          // transition out of PENDING_PAYMENT is CANCELLED (rideService.
          // cancelRide's cascade), so the driver commission was genuinely
          // captured for a now-cancelled ride. Apply the same time-based
          // cancellation policy the cascade itself would have applied, and
          // refund it (claude.md §31/§97 2026-08-13's flagged gap).
          const ride = await rideRepository.findById(result.rideId);
          const payment = await paymentRepository.findSuccessfulByRideId(tx, result.rideId);
          if (ride && payment) {
            const policy = calculateDriverCancellationRefund(payment.amount, ride.departureTime);
            if (policy.refundAmount > 0) {
              const refundTx = await transactionRepository.create(tx, {
                userId: payment.userId,
                bookingId: null,
                rideId: result.rideId,
                type: 'REFUND',
                amount: policy.refundAmount,
                provider: paymentProviderName,
                providerReference: null,
              });
              refundTransactionIds.push(refundTx.id);
            }
          }
        }
      } else {
        await rideRepository.failPayment(tx, result.rideId);
      }
    } else if (result.transactionType === 'BOOKING_PREPAYMENT' && result.bookingId) {
      if (outcome === 'SUCCESS') {
        const applied = await bookingRepository.confirmPayment(tx, result.bookingId);
        bookingConfirmed = applied;
        if (!applied) {
          // The booking left PENDING_PAYMENT some other way (TTL expiry,
          // passenger self-cancel, or the ride-cancellation cascade) before
          // this payment resolved. Whatever the reason, the passenger paid
          // for a booking that no longer exists in a valid state — refund
          // the full captured amount rather than silently keeping it
          // (claude.md §97 2026-08-13's flagged gap). Recorded as SUCCESS on
          // the Payment/Transaction above (accurate — money did move); the
          // booking itself stays whatever terminal state it already reached.
          const payment = await paymentRepository.findSuccessfulByBookingId(tx, result.bookingId);
          if (payment) {
            const refundTx = await transactionRepository.create(tx, {
              userId: payment.userId,
              bookingId: result.bookingId,
              rideId: payment.rideId,
              type: 'REFUND',
              amount: payment.amount,
              provider: paymentProviderName,
              providerReference: null,
            });
            refundTransactionIds.push(refundTx.id);
          }
        }
      } else {
        const booking = await bookingRepository.findById(result.bookingId, tx);
        const failed = await bookingRepository.failPayment(tx, result.bookingId);
        if (failed && booking) {
          await rideRepository.releaseSeats(tx, booking.rideId, booking.seatCount);
        }
      }
    } else if (result.transactionType === 'FINAL_PAYMENT' && result.bookingId) {
      if (outcome === 'SUCCESS') {
        const applied = await bookingRepository.completeBooking(tx, result.bookingId);
        if (applied) {
          const booking = await bookingRepository.findById(result.bookingId, tx);
          if (booking) {
            // claude.md §41/§84: "application commission is calculated
            // exactly once" — computed here and logged in a structured,
            // greppable form. No wallet/payout system is in scope (§6) to
            // persist the split into.
            const settlement = calculateSettlement(booking.totalFare);
            console.log(
              `Ride settlement: rideId=${booking.rideId} bookingId=${booking.id} totalFare=${booking.totalFare} platformCommission=${settlement.platformCommission} driverShare=${settlement.driverShare}`,
            );
          }
        } else {
          console.error(
            `Final payment succeeded for booking ${result.bookingId} but it was no longer CONFIRMED — needs manual review.`,
          );
        }
      } else {
        // No seat to release (the ride already happened) and no automatic
        // retry path specified — the booking stays CONFIRMED, still owing
        // the remaining fare, flagged for manual follow-up.
        console.error(`Final payment failed for booking ${result.bookingId} — needs manual follow-up.`);
      }
    }

    return { resolution: result, refundTransactionIds, bookingConfirmed };
  });

  if (resolution.kind === 'not_found') {
    // Could be a real race (webhook arrived before our own Payment row
    // commit) — a non-200 response makes Razorpay retry, which resolves
    // itself once that write lands.
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'No payment found for this order id');
  }

  if (resolution.kind === 'resolved' && resolution.transactionType === 'BOOKING_PREPAYMENT' && resolution.bookingId) {
    await cancelScheduledBookingExpiry(resolution.bookingId);
  }

  await Promise.all(refundTransactionIds.map((id) => scheduleRefund(id)));

  if (resolution.kind === 'resolved') {
    const reference = { rideId: resolution.rideId, bookingId: resolution.bookingId };
    if (outcome === 'SUCCESS') {
      await notificationService.notifyPaymentSuccess(resolution.userId, resolution.amount, reference);
      if (bookingConfirmed && resolution.bookingId && resolution.rideId) {
        await notificationService.notifyBookingConfirmed(resolution.userId, resolution.bookingId, resolution.rideId);
      }
    } else {
      await notificationService.notifyPaymentFailed(resolution.userId, resolution.amount, reference);
    }
  }
}
