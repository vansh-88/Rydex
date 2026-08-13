import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { paymentProvider, paymentProviderName } from '../../../infrastructure/payments/index.js';
import * as paymentRecordService from '../../payment/services/paymentRecordService.js';
import * as bookingRepository from '../repositories/bookingRepository.js';
import { calculateRemainingFare } from './settlementService.js';

const BOOKING_CURRENCY = 'INR';

// claude.md §41 (Phase 11): triggered by rideService.completeRide once
// rideRepository.complete() succeeds — collects the remaining 90% from every
// CONFIRMED booking on the ride, using the fare locked on the booking
// (never recalculated). Mirrors bookingService.createBooking's existing
// external-call-then-follow-up-tx pattern (§5.5):
// PaymentProvider.createOrder() runs outside any DB transaction.
export async function createFinalPaymentOrdersForRide(rideId: string): Promise<void> {
  const bookings = await bookingRepository.findConfirmedByRideId(rideId);

  await Promise.allSettled(
    bookings.map(async (booking) => {
      // Idempotency: lets a manual re-invocation (after a partial failure —
      // e.g. crash mid-loop) safely skip bookings that already got an order,
      // since completeRide itself can't be retried once the ride is
      // COMPLETED (rideRepository.complete's own conditional guard).
      if (booking.finalPaymentOrderId !== null) {
        return;
      }

      const remainingAmount = calculateRemainingFare(booking.totalFare, booking.prepaidAmount);
      if (remainingAmount <= 0) {
        return;
      }

      try {
        const order = await paymentProvider.createOrder({
          amount: remainingAmount,
          currency: BOOKING_CURRENCY,
          receipt: `booking-final-payment:${booking.id}`,
        });

        await prisma.$transaction(async (tx) => {
          await bookingRepository.setFinalPaymentOrderId(booking.id, order.providerOrderId, tx);
          await paymentRecordService.recordOrder(tx, {
            userId: booking.passengerId,
            bookingId: booking.id,
            rideId,
            type: 'FINAL_PAYMENT',
            amount: remainingAmount,
            currency: BOOKING_CURRENCY,
            provider: paymentProviderName,
            providerOrderId: order.providerOrderId,
          });
        });
      } catch (err) {
        // A failure here must not block ride completion or other bookings'
        // final-payment orders — surfaced loudly for manual follow-up, same
        // "needs manual review" pattern webhookService already uses for
        // gaps that can't be auto-resolved.
        console.error(`Failed to create final payment order for booking ${booking.id}:`, err);
      }
    }),
  );
}
