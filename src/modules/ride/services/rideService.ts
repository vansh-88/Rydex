import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { mapProvider } from '../../../infrastructure/maps/index.js';
import { paymentProvider, paymentProviderName } from '../../../infrastructure/payments/index.js';
import * as paymentRecordService from '../../payment/services/paymentRecordService.js';
import * as paymentRepository from '../../payment/repositories/paymentRepository.js';
import * as transactionRepository from '../../payment/repositories/transactionRepository.js';
import { scheduleRefund } from '../../payment/services/refundService.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../../user/repositories/userRepository.js';
import * as bookingRepository from '../../booking/repositories/bookingRepository.js';
import { cancelScheduledBookingExpiry } from '../../booking/services/bookingExpiryService.js';
import { createFinalPaymentOrdersForRide } from '../../booking/services/finalPaymentService.js';
import * as notificationService from '../../notification/services/notificationService.js';
import * as rideRepository from '../repositories/rideRepository.js';
import type { RideRecord } from '../repositories/rideRepository.js';
import { calculateFare } from './fareService.js';
import { calculatePostingCommission } from './commissionService.js';
import { calculateDriverCancellationRefund } from './cancellationPolicyService.js';
import { assertVehicleEligibleForRide } from './vehicleEligibilityService.js';
import type { CreateRideInput } from '../schemas/rideSchemas.js';

export interface RideDto {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: { latitude: number; longitude: number; address: string | null };
  destination: { latitude: number; longitude: number; address: string | null };
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: unknown;
  postingCommissionAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrderDto {
  providerOrderId: string;
  amount: number;
  currency: string;
}

const RIDE_CURRENCY = 'INR';

function toRideDto(ride: RideRecord): RideDto {
  return {
    id: ride.id,
    driverId: ride.driverId,
    vehicleId: ride.vehicleId,
    origin: { ...ride.origin, address: ride.originAddress },
    destination: { ...ride.destination, address: ride.destinationAddress },
    departureTime: ride.departureTime.toISOString(),
    availableSeats: ride.availableSeats,
    totalSeats: ride.totalSeats,
    farePerSeat: ride.farePerSeat,
    distanceMeters: ride.distanceMeters,
    durationSeconds: ride.durationSeconds,
    routeGeometry: JSON.parse(ride.routeGeometry) as unknown,
    postingCommissionAmount: ride.postingCommissionAmount,
    status: ride.status,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString(),
  };
}

// claude.md §18 creation flow. Every external call (MapProvider,
// PaymentProvider) happens before the single DB write — claude.md §5.5:
// "external calls are not part of DB transactions."
export async function createRide(
  driverId: string,
  input: CreateRideInput,
): Promise<{ ride: RideDto; paymentOrder: PaymentOrderDto }> {
  const vehicle = await assertVehicleEligibleForRide(
    driverId,
    input.vehicleId,
    input.availableSeats,
  );

  const driver = await userRepository.findById(driverId);
  if (!driver) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Driver not found');
  }

  const route = await mapProvider.getRoute(input.origin, input.destination, input.waypoints);

  const fare = calculateFare({
    distanceMeters: route.distanceMeters,
    vehicleType: vehicle.vehicleType,
    driverRatingAverage:
      driver.driverRatingAverage === null ? null : driver.driverRatingAverage.toNumber(),
  });

  const postingCommissionAmount = calculatePostingCommission(
    fare.farePerSeat,
    input.availableSeats,
  );

  const order = await paymentProvider.createOrder({
    amount: postingCommissionAmount,
    currency: RIDE_CURRENCY,
    receipt: `ride-posting-commission:${driverId}:${input.vehicleId}:${input.departureTime.toISOString()}`,
  });

  // claude.md §38/§97 (2026-08-13): the ride INSERT and its Payment/
  // Transaction rows are created atomically together — both are internal DB
  // writes at this point (the external createOrder() call already happened
  // above), so there's no §5.5 conflict wrapping them in one transaction.
  const ride = await prisma.$transaction(async (tx) => {
    const created = await rideRepository.create(
      {
        driverId,
        vehicleId: input.vehicleId,
        origin: input.origin,
        destination: input.destination,
        originAddress: input.originAddress ?? null,
        destinationAddress: input.destinationAddress ?? null,
        departureTime: input.departureTime,
        availableSeats: input.availableSeats,
        farePerSeat: fare.farePerSeat,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        routeGeometry: route.geometry,
        postingCommissionAmount,
        postingCommissionOrderId: order.providerOrderId,
      },
      tx,
    );

    await paymentRecordService.recordOrder(tx, {
      userId: driverId,
      bookingId: null,
      rideId: created.id,
      type: 'DRIVER_RIDE_FEE',
      amount: postingCommissionAmount,
      currency: RIDE_CURRENCY,
      provider: paymentProviderName,
      providerOrderId: order.providerOrderId,
    });

    return created;
  });

  return {
    ride: toRideDto(ride),
    paymentOrder: {
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
    },
  };
}

export async function getRide(rideId: string): Promise<RideDto> {
  const ride = await rideRepository.findById(rideId);
  if (!ride) {
    throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  }
  return toRideDto(ride);
}

export interface RideSummaryDto {
  id: string;
  originAddress: string | null;
  destinationAddress: string | null;
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: number;
  status: string;
}

const RECENT_RIDES_LIMIT = 10;

// claude.md §96.5: backs the support-chatbot tool getMyRecentRidesAsDriver —
// scoped to the authenticated driverId only. Returns a lighter summary than
// RideDto (no origin/destination coordinates) since rideRepository.
// findRecentByDriverId deliberately avoids the raw-SQL geography read for a
// list this size doesn't need (see that function's comment).
export async function getMyRecentRidesAsDriver(driverId: string): Promise<RideSummaryDto[]> {
  const rows = await rideRepository.findRecentByDriverId(driverId, RECENT_RIDES_LIMIT);
  return rows.map((row) => ({
    id: row.id,
    originAddress: row.originAddress,
    destinationAddress: row.destinationAddress,
    departureTime: row.departureTime.toISOString(),
    availableSeats: row.availableSeats,
    totalSeats: row.totalSeats,
    farePerSeat: row.farePerSeat.toNumber(),
    status: row.status,
  }));
}

async function getOwnedRideOrThrow(driverId: string, rideId: string): Promise<RideRecord> {
  const ride = await rideRepository.findById(rideId);
  if (!ride || ride.driverId !== driverId) {
    throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  }
  return ride;
}

// claude.md §31/§34/§59 (Phase 11): driver cancellation cascades — every
// still-active booking on the ride is cancelled and its seat released; a
// booking that had actually been paid (CONFIRMED) gets its 10% prepayment
// refunded in full; the driver's own 5% posting commission is refunded per
// cancellationPolicyService's time-based rule, only if it was actually
// captured. Refund intents are recorded as PENDING REFUND transactions
// inside this same DB transaction (§59: "create refund records / refund
// intents"); the actual PaymentProvider.refund() call is deferred to an
// async BullMQ job scheduled after commit (§5.5: external calls are not
// part of DB transactions).
export async function cancelRide(driverId: string, rideId: string): Promise<RideDto> {
  const ride = await getOwnedRideOrThrow(driverId, rideId);

  const refundPolicy = calculateDriverCancellationRefund(
    ride.postingCommissionAmount,
    ride.departureTime,
  );

  const { refundTransactionIds, expiredBookingIds, cancelledPassengerIds } =
    await prisma.$transaction(async (tx) => {
      const applied = await rideRepository.cancel(tx, rideId);
      if (!applied) {
        throw new AppError(
          409,
          'INVALID_RIDE_STATE',
          'Ride cannot be cancelled from its current state',
        );
      }

      const refundTransactionIds: string[] = [];
      const expiredBookingIds: string[] = [];
      const cancelledPassengerIds: string[] = [];

      const activeBookings = await bookingRepository.findActiveByRideId(tx, rideId);
      for (const booking of activeBookings) {
        // Gate everything off cancel()'s own return value, not the snapshot
        // above — a booking could have left the active set via a
        // concurrently-committed tx (e.g. the passenger self-cancelling at
        // the same moment) between the find and this call.
        const cancelled = await bookingRepository.cancel(tx, booking.id);
        if (!cancelled) {
          continue;
        }

        await rideRepository.releaseSeats(tx, rideId, booking.seatCount);
        cancelledPassengerIds.push(booking.passengerId);

        if (booking.status === 'CONFIRMED') {
          const refundTx = await transactionRepository.create(tx, {
            userId: booking.passengerId,
            bookingId: booking.id,
            rideId,
            type: 'REFUND',
            amount: booking.prepaidAmount,
            provider: paymentProviderName,
            providerReference: null,
          });
          refundTransactionIds.push(refundTx.id);
        } else {
          // Was PENDING_PAYMENT — its scheduled TTL expiry job is now pointless.
          expiredBookingIds.push(booking.id);
        }
      }

      if (refundPolicy.refundAmount > 0) {
        const originalPayment = await paymentRepository.findSuccessfulByRideId(tx, rideId);
        if (originalPayment) {
          const refundTx = await transactionRepository.create(tx, {
            userId: driverId,
            bookingId: null,
            rideId,
            type: 'REFUND',
            amount: refundPolicy.refundAmount,
            provider: paymentProviderName,
            providerReference: null,
          });
          refundTransactionIds.push(refundTx.id);
        }
      }

      return { refundTransactionIds, expiredBookingIds, cancelledPassengerIds };
    });

  await Promise.all([
    ...refundTransactionIds.map((id) => scheduleRefund(id)),
    ...expiredBookingIds.map((id) => cancelScheduledBookingExpiry(id)),
    ...cancelledPassengerIds.map((passengerId) =>
      notificationService.notifyRideCancelled(passengerId, rideId),
    ),
  ]);

  return getRide(rideId);
}

export async function startRide(driverId: string, rideId: string): Promise<RideDto> {
  await getOwnedRideOrThrow(driverId, rideId);

  const applied = await rideRepository.start(rideId);
  if (!applied) {
    throw new AppError(409, 'INVALID_RIDE_STATE', 'Ride cannot be started from its current state');
  }

  const confirmedBookings = await bookingRepository.findConfirmedByRideId(rideId);
  await Promise.all(
    confirmedBookings.map((booking) =>
      notificationService.notifyRideStarting(booking.passengerId, rideId),
    ),
  );

  return getRide(rideId);
}

export async function completeRide(driverId: string, rideId: string): Promise<RideDto> {
  await getOwnedRideOrThrow(driverId, rideId);

  const applied = await rideRepository.complete(rideId);
  if (!applied) {
    throw new AppError(
      409,
      'INVALID_RIDE_STATE',
      'Ride cannot be completed from its current state',
    );
  }

  const confirmedBookings = await bookingRepository.findConfirmedByRideId(rideId);
  await Promise.all(
    confirmedBookings.map((booking) =>
      notificationService.notifyRideCompleted(booking.passengerId, rideId),
    ),
  );

  // claude.md §41 (Phase 11): collect the remaining 90% from every CONFIRMED
  // booking. External PaymentProvider calls, so kept outside the state
  // transition above (§5.5); failures are logged per-booking and don't
  // block the ride from being reported as COMPLETED.
  await createFinalPaymentOrdersForRide(rideId);

  return getRide(rideId);
}
