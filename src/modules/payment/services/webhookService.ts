import { z } from 'zod';

import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { paymentProvider } from '../../../infrastructure/payments/index.js';
import * as bookingRepository from '../../booking/repositories/bookingRepository.js';
import { cancelScheduledBookingExpiry } from '../../booking/services/bookingExpiryService.js';
import * as rideRepository from '../../ride/repositories/rideRepository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as paymentRecordService from './paymentRecordService.js';
import type { PaymentOutcome } from './paymentRecordService.js';

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

  const resolution = await prisma.$transaction(async (tx) => {
    const result = await paymentRecordService.resolvePaymentByOrderId(
      tx,
      paymentEntity.order_id,
      outcome,
      paymentEntity.id,
    );

    if (result.kind !== 'resolved') {
      return result;
    }

    if (result.transactionType === 'DRIVER_RIDE_FEE' && result.rideId) {
      if (outcome === 'SUCCESS') {
        const applied = await rideRepository.confirmPayment(tx, result.rideId);
        if (!applied) {
          // The ride left PENDING_PAYMENT some other way (e.g. driver
          // cancelled) before this payment resolved. The commission was
          // genuinely captured — that's recorded correctly above — but
          // nothing here can safely re-open the ride. Surfaced loudly since
          // there's no automatic refund path yet (Phase 11).
          console.error(
            `Payment succeeded for ride ${result.rideId} but it was no longer PENDING_PAYMENT — needs manual refund review (Phase 11 has no automatic path yet).`,
          );
        }
      } else {
        await rideRepository.failPayment(tx, result.rideId);
      }
    } else if (result.transactionType === 'BOOKING_PREPAYMENT' && result.bookingId) {
      if (outcome === 'SUCCESS') {
        const applied = await bookingRepository.confirmPayment(tx, result.bookingId);
        if (!applied) {
          // Same reasoning as above — most likely the TTL expiry job won
          // the race and already released the seat (possibly to another
          // passenger by now), so silently "confirming" here would risk
          // overselling. Recorded as SUCCESS on the Payment/Transaction
          // (accurate — money did move); the booking itself stays whatever
          // terminal state it already reached. Needs manual refund review.
          console.error(
            `Payment succeeded for booking ${result.bookingId} but it was no longer PENDING_PAYMENT (likely TTL-expired) — needs manual refund review (Phase 11 has no automatic path yet).`,
          );
        }
      } else {
        const booking = await bookingRepository.findById(result.bookingId, tx);
        const failed = await bookingRepository.failPayment(tx, result.bookingId);
        if (failed && booking) {
          await rideRepository.releaseSeats(tx, booking.rideId, booking.seatCount);
        }
      }
    }

    return result;
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
}
