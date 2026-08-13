import { env } from '../../../config/env.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { paymentProvider, paymentProviderName } from '../../../infrastructure/payments/index.js';
import * as paymentRecordService from '../../payment/services/paymentRecordService.js';
import * as rideRepository from '../../ride/repositories/rideRepository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as notificationService from '../../notification/services/notificationService.js';
import * as bookingRepository from '../repositories/bookingRepository.js';
import type { BookingRecord } from '../repositories/bookingRepository.js';
import type { CreateBookingInput } from '../schemas/bookingSchemas.js';
import { cancelScheduledBookingExpiry, scheduleBookingExpiry } from './bookingExpiryService.js';

export interface BookingDto {
  id: string;
  rideId: string;
  passengerId: string;
  seatCount: number;
  pickup: { latitude: number; longitude: number };
  drop: { latitude: number; longitude: number };
  farePerSeat: number;
  totalFare: number;
  prepaidAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrderDto {
  providerOrderId: string;
  amount: number;
  currency: string;
}

const BOOKING_CURRENCY = 'INR';

function toBookingDto(booking: BookingRecord): BookingDto {
  return {
    id: booking.id,
    rideId: booking.rideId,
    passengerId: booking.passengerId,
    seatCount: booking.seatCount,
    pickup: { latitude: booking.pickupLat, longitude: booking.pickupLng },
    drop: { latitude: booking.dropLat, longitude: booking.dropLng },
    farePerSeat: booking.farePerSeat,
    totalFare: booking.totalFare,
    prepaidAmount: booking.prepaidAmount,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

const BOOKABLE_RIDE_STATUSES = ['OPEN', 'FULL'];

// claude.md §18/§35/§36 creation flow, mirrored from rideService.createRide:
// the seat reservation + booking INSERT are one DB transaction (no external
// calls inside it, §5.5); PaymentProvider.createOrder() happens after commit,
// then a follow-up single-row update attaches the order id.
export async function createBooking(
  passengerId: string,
  rideId: string,
  input: CreateBookingInput,
): Promise<{ booking: BookingDto; paymentOrder: PaymentOrderDto }> {
  const ride = await rideRepository.findById(rideId);
  if (!ride) {
    throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  }
  if (!BOOKABLE_RIDE_STATUSES.includes(ride.status)) {
    throw new AppError(409, 'RIDE_NOT_BOOKABLE', 'Ride is not currently bookable');
  }
  if (ride.driverId === passengerId) {
    throw new AppError(409, 'CANNOT_BOOK_OWN_RIDE', 'A driver cannot book their own ride');
  }

  const pickup = input.pickup ?? ride.origin;
  const drop = input.drop ?? ride.destination;

  const booking = await prisma.$transaction(async (tx) => {
    const reserved = await rideRepository.reserveSeats(tx, rideId, input.seatCount);
    if (!reserved) {
      throw new AppError(409, 'NO_SEATS_AVAILABLE', 'Not enough seats available on this ride');
    }

    const totalFare = reserved.farePerSeat * input.seatCount;
    const prepaidAmount = Math.round(totalFare * (env.PASSENGER_PREPAYMENT_PERCENT / 100));

    return bookingRepository.create(tx, {
      rideId,
      passengerId,
      seatCount: input.seatCount,
      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      dropLat: drop.latitude,
      dropLng: drop.longitude,
      farePerSeat: reserved.farePerSeat,
      totalFare,
      prepaidAmount,
    });
  });

  const order = await paymentProvider.createOrder({
    amount: booking.prepaidAmount,
    currency: BOOKING_CURRENCY,
    receipt: `booking-prepayment:${booking.id}`,
  });

  // claude.md §38/§97 (2026-08-13): setPrepaymentOrderId + Payment/
  // Transaction creation happen together, atomically, in a follow-up
  // transaction — separate from the seat-reservation one above because the
  // external createOrder() call sits between them (§5.5).
  await prisma.$transaction(async (tx) => {
    await bookingRepository.setPrepaymentOrderId(booking.id, order.providerOrderId, tx);
    await paymentRecordService.recordOrder(tx, {
      userId: passengerId,
      bookingId: booking.id,
      rideId: booking.rideId,
      type: 'BOOKING_PREPAYMENT',
      amount: booking.prepaidAmount,
      currency: BOOKING_CURRENCY,
      provider: paymentProviderName,
      providerOrderId: order.providerOrderId,
    });
  });

  await scheduleBookingExpiry(booking.id, env.BOOKING_PAYMENT_TTL_SECONDS);

  // claude.md §42: fire-and-forget enqueue, never awaited-through to actual
  // delivery — does not block this response on FCM.
  await notificationService.notifyRideBooked(ride.driverId, rideId, input.seatCount);

  return {
    booking: toBookingDto({ ...booking, prepaymentOrderId: order.providerOrderId }),
    paymentOrder: { providerOrderId: order.providerOrderId, amount: order.amount, currency: order.currency },
  };
}

// claude.md §54: visible to the passenger who made it, or the driver of the
// associated ride (they need to know who's booked their ride) — nobody else.
export async function getBooking(userId: string, bookingId: string): Promise<BookingDto> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }

  if (booking.passengerId !== userId) {
    const ride = await rideRepository.findById(booking.rideId);
    if (!ride || ride.driverId !== userId) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
  }

  return toBookingDto(booking);
}

// claude.md §34: only the passenger who made the booking may cancel it —
// this is not the driver's ride-cancellation flow (rideService.cancelRide,
// Phase 7), which cascades differently and is a Phase 11 concern for bookings.
export async function cancelBooking(passengerId: string, bookingId: string): Promise<BookingDto> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.passengerId !== passengerId) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    // claude.md §41/§84 (Phase 11): once the ride has STARTED/COMPLETED, a
    // CONFIRMED booking owes (or will owe) the final 90% payment — cancelling
    // it here would let the passenger dodge that. Checked inside the
    // transaction (not before it) to avoid a TOCTOU gap against a
    // concurrently-starting ride.
    const rideStatus = await rideRepository.findStatusById(tx, booking.rideId);
    if (rideStatus === 'STARTED' || rideStatus === 'COMPLETED') {
      throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'Booking cannot be cancelled once the ride has started');
    }

    const applied = await bookingRepository.cancel(tx, bookingId);
    if (applied) {
      await rideRepository.releaseSeats(tx, booking.rideId, booking.seatCount);
    }
    return applied;
  });

  if (!cancelled) {
    throw new AppError(409, 'BOOKING_ALREADY_CANCELLED', 'Booking cannot be cancelled from its current state');
  }

  // §97 (2026-08-13): no longer any reason for the TTL job to fire later.
  await cancelScheduledBookingExpiry(bookingId);

  await notificationService.notifyBookingCancelled(passengerId, bookingId);

  return getBooking(passengerId, bookingId);
}
