import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { mapProvider } from '../../../infrastructure/maps/index.js';
import { paymentProvider, paymentProviderName } from '../../../infrastructure/payments/index.js';
import * as paymentRecordService from '../../payment/services/paymentRecordService.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../../user/repositories/userRepository.js';
import * as rideRepository from '../repositories/rideRepository.js';
import type { RideRecord } from '../repositories/rideRepository.js';
import { calculateFare } from './fareService.js';
import { calculatePostingCommission } from './commissionService.js';
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
  const vehicle = await assertVehicleEligibleForRide(driverId, input.vehicleId, input.availableSeats);

  const driver = await userRepository.findById(driverId);
  if (!driver) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Driver not found');
  }

  const route = await mapProvider.getRoute(input.origin, input.destination, input.waypoints);

  const fare = calculateFare({
    distanceMeters: route.distanceMeters,
    vehicleType: vehicle.vehicleType,
    driverRatingAverage: driver.ratingAverage === null ? null : driver.ratingAverage.toNumber(),
  });

  const postingCommissionAmount = calculatePostingCommission(fare.farePerSeat, input.availableSeats);

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
    paymentOrder: { providerOrderId: order.providerOrderId, amount: order.amount, currency: order.currency },
  };
}

export async function getRide(rideId: string): Promise<RideDto> {
  const ride = await rideRepository.findById(rideId);
  if (!ride) {
    throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  }
  return toRideDto(ride);
}

async function getOwnedRideOrThrow(driverId: string, rideId: string): Promise<RideRecord> {
  const ride = await rideRepository.findById(rideId);
  if (!ride || ride.driverId !== driverId) {
    throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  }
  return ride;
}

// claude.md §19: transitions are conditional updates in the repository —
// only a ride still in an allowed source state actually flips. Refunding
// the posting commission / passenger prepayments on cancellation is
// centralized cancellation-policy logic that belongs to Phase 11 (§31/§59);
// no Booking/Payment/Transaction tables exist yet for this phase to touch.
export async function cancelRide(driverId: string, rideId: string): Promise<RideDto> {
  await getOwnedRideOrThrow(driverId, rideId);

  const applied = await rideRepository.cancel(rideId);
  if (!applied) {
    throw new AppError(409, 'INVALID_RIDE_STATE', 'Ride cannot be cancelled from its current state');
  }

  return getRide(rideId);
}

export async function startRide(driverId: string, rideId: string): Promise<RideDto> {
  await getOwnedRideOrThrow(driverId, rideId);

  const applied = await rideRepository.start(rideId);
  if (!applied) {
    throw new AppError(409, 'INVALID_RIDE_STATE', 'Ride cannot be started from its current state');
  }

  return getRide(rideId);
}

export async function completeRide(driverId: string, rideId: string): Promise<RideDto> {
  await getOwnedRideOrThrow(driverId, rideId);

  const applied = await rideRepository.complete(rideId);
  if (!applied) {
    throw new AppError(409, 'INVALID_RIDE_STATE', 'Ride cannot be completed from its current state');
  }

  return getRide(rideId);
}
