import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client.js';
import type { RideStatus } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CreateRideInput {
  driverId: string;
  vehicleId: string;
  origin: Coordinates;
  destination: Coordinates;
  originAddress: string | null;
  destinationAddress: string | null;
  departureTime: Date;
  availableSeats: number;
  farePerSeat: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: string;
  postingCommissionAmount: number;
  postingCommissionOrderId: string;
}

// Raw-row shape as returned by the hand-written SQL below (snake_case,
// geography columns flattened to lat/lng via ST_Y/ST_X) — mapped to
// RideRecord by the two functions that use it.
interface RideRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  origin_address: string | null;
  destination_address: string | null;
  departure_time: Date;
  available_seats: number;
  total_seats: number;
  fare_per_seat: string;
  distance_meters: number;
  duration_seconds: number;
  route_geometry: string;
  posting_commission_amount: string;
  posting_commission_order_id: string;
  status: RideStatus;
  created_at: Date;
  updated_at: Date;
}

export interface RideRecord {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: Coordinates;
  destination: Coordinates;
  originAddress: string | null;
  destinationAddress: string | null;
  departureTime: Date;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: string;
  postingCommissionAmount: number;
  postingCommissionOrderId: string;
  status: RideStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toRideRecord(row: RideRow): RideRecord {
  return {
    id: row.id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    origin: { latitude: row.origin_lat, longitude: row.origin_lng },
    destination: { latitude: row.destination_lat, longitude: row.destination_lng },
    originAddress: row.origin_address,
    destinationAddress: row.destination_address,
    departureTime: row.departure_time,
    availableSeats: row.available_seats,
    totalSeats: row.total_seats,
    farePerSeat: Number(row.fare_per_seat),
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    routeGeometry: row.route_geometry,
    postingCommissionAmount: Number(row.posting_commission_amount),
    postingCommissionOrderId: row.posting_commission_order_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RIDE_ROW_SELECT = `
  id, driver_id, vehicle_id,
  ST_Y(origin::geometry) AS origin_lat, ST_X(origin::geometry) AS origin_lng,
  ST_Y(destination::geometry) AS destination_lat, ST_X(destination::geometry) AS destination_lng,
  origin_address, destination_address,
  departure_time, available_seats, total_seats, fare_per_seat,
  distance_meters, duration_seconds, route_geometry,
  posting_commission_amount, posting_commission_order_id,
  status, created_at, updated_at
`;

// claude.md §77: origin/destination are `Unsupported` in the Prisma schema
// (no native geography type), so creation and any read that needs
// coordinates go through raw SQL isolated to this repository. Status
// transitions below don't touch these columns and use the normal Prisma
// Client API instead.
//
// `db` defaults to the global `prisma` client but accepts a transaction
// client too (claude.md §97 2026-08-13) — Phase 10 needs the ride INSERT
// and its Payment/Transaction rows created atomically together.
export async function create(
  input: CreateRideInput,
  db: Prisma.TransactionClient = prisma,
): Promise<RideRecord> {
  const id = randomUUID();

  const query = Prisma.sql`
    INSERT INTO rides (
      id, driver_id, vehicle_id,
      origin, destination,
      origin_address, destination_address,
      departure_time,
      available_seats, total_seats,
      fare_per_seat,
      distance_meters, duration_seconds, route_geometry,
      posting_commission_amount, posting_commission_order_id,
      status, updated_at
    ) VALUES (
      ${id}, ${input.driverId}::uuid, ${input.vehicleId}::uuid,
      ST_SetSRID(ST_MakePoint(${input.origin.longitude}, ${input.origin.latitude}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${input.destination.longitude}, ${input.destination.latitude}), 4326)::geography,
      ${input.originAddress}, ${input.destinationAddress},
      ${input.departureTime},
      ${input.availableSeats}, ${input.availableSeats},
      ${input.farePerSeat},
      ${input.distanceMeters}, ${input.durationSeconds}, ${input.routeGeometry},
      ${input.postingCommissionAmount}, ${input.postingCommissionOrderId},
      'PENDING_PAYMENT', CURRENT_TIMESTAMP
    )
    RETURNING ${Prisma.raw(RIDE_ROW_SELECT)}
  `;

  const rows = await db.$queryRaw<RideRow[]>(query);

  const row = rows[0];
  if (!row) {
    throw new Error('Ride insert returned no row');
  }
  return toRideRecord(row);
}

export async function findById(id: string): Promise<RideRecord | null> {
  const query = Prisma.sql`SELECT ${Prisma.raw(RIDE_ROW_SELECT)} FROM rides WHERE id = ${id}::uuid`;
  const rows = await prisma.$queryRaw<RideRow[]>(query);

  const row = rows[0];
  return row ? toRideRecord(row) : null;
}

export interface RideSummaryRow {
  id: string;
  originAddress: string | null;
  destinationAddress: string | null;
  departureTime: Date;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: Prisma.Decimal;
  status: RideStatus;
}

// claude.md §96.5: backs the support-chatbot tool getMyRecentRidesAsDriver.
// Plain Prisma `select` that excludes origin/destination (the `Unsupported`
// geography columns, claude.md §77) — no raw SQL needed since this summary
// has no coordinate/distance requirement, same reasoning findStatusById
// below already relies on for a Prisma-Client-only read.
export async function findRecentByDriverId(
  driverId: string,
  limit: number,
): Promise<RideSummaryRow[]> {
  return prisma.ride.findMany({
    where: { driverId },
    select: {
      id: true,
      originAddress: true,
      destinationAddress: true,
      departureTime: true,
      availableSeats: true,
      totalSeats: true,
      farePerSeat: true,
      status: true,
    },
    orderBy: { departureTime: 'desc' },
    take: limit,
  });
}

const CANCELLABLE_FROM: RideStatus[] = ['PENDING_PAYMENT', 'OPEN', 'FULL'];
const STARTABLE_FROM: RideStatus[] = ['OPEN', 'FULL'];
const COMPLETABLE_FROM: RideStatus[] = ['STARTED'];

// Conditional updates (WHERE id = ? AND status IN (...)) — same
// concurrency-safe pattern as vehicleRepository.verifyVehicle/rejectVehicle
// (claude.md §58): the row only transitions if it's still in an allowed
// source state, so two concurrent transition attempts can't both apply.
//
// `db` is a required `Prisma.TransactionClient` (claude.md §97 2026-08-13
// precedent for the same tradeoff on `create`) — Phase 11's driver
// cancellation cascade (rideService.cancelRide) needs the ride transition
// and its bookings' cascade to commit atomically, and this is its only call
// site, so there's no reason to also support the standalone-`prisma` case.
export async function cancel(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.ride.updateMany({
    where: { id, status: { in: CANCELLABLE_FROM } },
    data: { status: 'CANCELLED' },
  });
  return result.count === 1;
}

// claude.md §59 (Phase 11): bookingService.cancelBooking's guard against a
// passenger dodging the final 90% payment by self-cancelling after the ride
// has already STARTED/COMPLETED. Plain Prisma call — `status` isn't an
// `Unsupported` geography column, no raw SQL needed.
export async function findStatusById(
  db: Prisma.TransactionClient,
  id: string,
): Promise<RideStatus | null> {
  const ride = await db.ride.findUnique({ where: { id }, select: { status: true } });
  return ride?.status ?? null;
}

export async function start(id: string): Promise<boolean> {
  const result = await prisma.ride.updateMany({
    where: { id, status: { in: STARTABLE_FROM } },
    data: { status: 'STARTED' },
  });
  return result.count === 1;
}

export async function complete(id: string): Promise<boolean> {
  const result = await prisma.ride.updateMany({
    where: { id, status: { in: COMPLETABLE_FROM } },
    data: { status: 'COMPLETED' },
  });
  return result.count === 1;
}

export interface ReservedSeats {
  farePerSeat: number;
  driverId: string;
}

// claude.md §35/§36: the seat hold IS this atomic conditional UPDATE — its
// WHERE guard (bookable status + enough seats) doubles as the "SELECT ride
// FOR UPDATE + check" step, taking a real row lock for the statement's
// duration exactly like rideRepository.cancel/start/complete above. Also
// flips OPEN -> FULL in the same statement when this booking exhausts the
// last seat (claude.md §19). Must run inside the same `db` transaction as
// the booking INSERT (claude.md §36) — pass the `tx` client, not `prisma`.
export async function reserveSeats(
  db: Prisma.TransactionClient,
  rideId: string,
  seatCount: number,
): Promise<ReservedSeats | null> {
  const rows = await db.$queryRaw<{ fare_per_seat: string; driver_id: string }[]>(Prisma.sql`
    UPDATE rides
    SET
      available_seats = available_seats - ${seatCount},
      status = CASE WHEN available_seats - ${seatCount} = 0 THEN 'FULL'::ride_status ELSE status END
    WHERE id = ${rideId}::uuid
      AND status IN ('OPEN', 'FULL')
      AND available_seats >= ${seatCount}
    RETURNING fare_per_seat, driver_id
  `);

  const row = rows[0];
  return row ? { farePerSeat: Number(row.fare_per_seat), driverId: row.driver_id } : null;
}

// Reverses reserveSeats. FULL -> OPEN only (never touches STARTED/COMPLETED/
// CANCELLED/PENDING_PAYMENT) — safe to call even if the ride moved on, since
// releasing a seat on a dead ride is a harmless no-op (search already
// excludes anything but OPEN/FULL, claude.md §22).
export async function releaseSeats(
  db: Prisma.TransactionClient,
  rideId: string,
  seatCount: number,
): Promise<void> {
  await db.$executeRaw(Prisma.sql`
    UPDATE rides
    SET
      available_seats = available_seats + ${seatCount},
      status = CASE WHEN status = 'FULL' THEN 'OPEN'::ride_status ELSE status END
    WHERE id = ${rideId}::uuid
  `);
}

// claude.md §19/§40: the posting-commission webhook's two outcomes. Only
// ever fires from PENDING_PAYMENT — same conditional-update idempotency
// pattern as everywhere else in this file, so a duplicate webhook delivery
// is a harmless no-op on the second call.
export async function confirmPayment(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.ride.updateMany({
    where: { id, status: 'PENDING_PAYMENT' },
    data: { status: 'OPEN' },
  });
  return result.count === 1;
}

export async function failPayment(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.ride.updateMany({
    where: { id, status: 'PENDING_PAYMENT' },
    data: { status: 'CANCELLED' },
  });
  return result.count === 1;
}
