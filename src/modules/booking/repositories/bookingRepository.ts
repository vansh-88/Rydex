import type { Prisma } from '../../../generated/prisma/client.js';
import type { BookingStatus } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateBookingInput {
  rideId: string;
  passengerId: string;
  seatCount: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  farePerSeat: number;
  totalFare: number;
  prepaidAmount: number;
}

export interface BookingRecord {
  id: string;
  rideId: string;
  passengerId: string;
  seatCount: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  farePerSeat: number;
  totalFare: number;
  prepaidAmount: number;
  prepaymentOrderId: string | null;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toBookingRecord(row: {
  id: string;
  rideId: string;
  passengerId: string;
  seatCount: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  farePerSeat: Prisma.Decimal;
  totalFare: Prisma.Decimal;
  prepaidAmount: Prisma.Decimal;
  prepaymentOrderId: string | null;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}): BookingRecord {
  return {
    id: row.id,
    rideId: row.rideId,
    passengerId: row.passengerId,
    seatCount: row.seatCount,
    pickupLat: row.pickupLat,
    pickupLng: row.pickupLng,
    dropLat: row.dropLat,
    dropLng: row.dropLng,
    farePerSeat: row.farePerSeat.toNumber(),
    totalFare: row.totalFare.toNumber(),
    prepaidAmount: row.prepaidAmount.toNumber(),
    prepaymentOrderId: row.prepaymentOrderId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// No Unsupported/geography columns here (unlike rideRepository) — booking
// has no spatial-query requirement in this phase, so plain Prisma Client
// calls work throughout, including inside the seat-reservation transaction.
export async function create(db: Prisma.TransactionClient, input: CreateBookingInput): Promise<BookingRecord> {
  const booking = await db.booking.create({ data: input });
  return toBookingRecord(booking);
}

export async function findById(id: string, db: Prisma.TransactionClient = prisma): Promise<BookingRecord | null> {
  const booking = await db.booking.findUnique({ where: { id } });
  return booking ? toBookingRecord(booking) : null;
}

export async function setPrepaymentOrderId(
  id: string,
  prepaymentOrderId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.booking.update({ where: { id }, data: { prepaymentOrderId } });
}

const CANCELLABLE_FROM: BookingStatus[] = ['PENDING_PAYMENT', 'CONFIRMED'];
const EXPIRABLE_FROM: BookingStatus[] = ['PENDING_PAYMENT'];
const PAYABLE_FROM: BookingStatus[] = ['PENDING_PAYMENT'];

// claude.md §34: a passenger may cancel while PENDING_PAYMENT (before ever
// paying) or CONFIRMED (after paying, forfeiting the prepaid amount — the
// actual forfeiture logic is Phase 11). Same conditional-update
// concurrency-safety pattern as rideRepository (§58).
export async function cancel(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.booking.updateMany({
    where: { id, status: { in: CANCELLABLE_FROM } },
    data: { status: 'CANCELLED' },
  });
  return result.count === 1;
}

// claude.md §35/§36: only ever fires from PENDING_PAYMENT — a booking that's
// already CONFIRMED by the time the TTL job runs must never be touched by
// it. This is what makes the expiry job idempotent/race-safe against a
// concurrent payment confirmation (Phase 10).
export async function expireIfPending(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.booking.updateMany({
    where: { id, status: { in: EXPIRABLE_FROM } },
    data: { status: 'CANCELLED' },
  });
  return result.count === 1;
}

// claude.md §33/§40: the prepayment webhook's two outcomes. Only ever fires
// from PENDING_PAYMENT — same idempotent conditional-update pattern as the
// rest of this file, so a duplicate webhook delivery is a no-op the second
// time.
export async function confirmPayment(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.booking.updateMany({
    where: { id, status: { in: PAYABLE_FROM } },
    data: { status: 'CONFIRMED' },
  });
  return result.count === 1;
}

// Unlike expireIfPending (TTL) and cancel (passenger-initiated), a definite
// payment failure releases the seat immediately rather than waiting for the
// TTL job — claude.md §36's "do not trust Redis alone for final seat
// consistency" extends to "don't make a passenger wait out a timer for a
// seat we already know is dead." Caller (bookingPaymentService) releases
// seats in the same transaction when this returns true.
export async function failPayment(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const result = await db.booking.updateMany({
    where: { id, status: { in: PAYABLE_FROM } },
    data: { status: 'PAYMENT_FAILED' },
  });
  return result.count === 1;
}
