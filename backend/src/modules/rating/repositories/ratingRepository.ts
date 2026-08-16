import { Prisma } from '../../../generated/prisma/client.js';
import type { RatingRole } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateRatingInput {
  rideId: string;
  bookingId: string;
  raterId: string;
  rateeId: string;
  rateeRole: RatingRole;
  score: number;
  comment: string | null;
}

export interface RatingRecord {
  id: string;
  rideId: string;
  bookingId: string;
  raterId: string;
  rateeId: string;
  rateeRole: RatingRole;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export async function create(
  db: Prisma.TransactionClient,
  input: CreateRatingInput,
): Promise<RatingRecord> {
  return db.rating.create({ data: input });
}

// Both ratings on a booking (each participant's, if submitted) — the service
// scopes what the caller is allowed to see.
export async function findByBookingId(bookingId: string): Promise<RatingRecord[]> {
  return prisma.rating.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
}

// The aggregate lives in two column pairs rather than one, so the column names
// vary by role. Column identifiers can't be parameterised, so they are picked
// by a `switch` over the validated enum and emitted as compile-time constants —
// exactly the pattern rideSearchRepository.sortExpression uses to keep a
// dynamic-looking query free of anything client-supplied (claude.md §25/§68).
function aggregateColumns(role: RatingRole): { average: Prisma.Sql; count: Prisma.Sql } {
  switch (role) {
    case 'DRIVER':
      return {
        average: Prisma.raw('driver_rating_average'),
        count: Prisma.raw('driver_rating_count'),
      };
    case 'PASSENGER':
      return {
        average: Prisma.raw('passenger_rating_average'),
        count: Prisma.raw('passenger_rating_count'),
      };
  }
}

/**
 * Folds one score into the ratee's running average, as a single statement.
 *
 * Deliberately NOT read-modify-write. Loading the average into Node, computing
 * the new one and writing it back would lose one of two ratings submitted for
 * the same user concurrently — the classic lost update. Computing it inside the
 * UPDATE means the row lock the statement already takes covers the read too,
 * the same reasoning that makes rideRepository.reserveSeats safe (claude.md
 * §58).
 *
 * Must run in the same transaction as the Rating insert, so a duplicate insert
 * (rejected by the (booking_id, rater_id) unique constraint) rolls this back
 * with it and can never double-count.
 */
export async function applyToAggregate(
  db: Prisma.TransactionClient,
  rateeId: string,
  role: RatingRole,
  score: number,
): Promise<void> {
  const { average, count } = aggregateColumns(role);

  await db.$executeRaw(Prisma.sql`
    UPDATE users
    SET
      ${average} = ROUND(((COALESCE(${average}, 0) * ${count}) + ${score}) / (${count} + 1), 2),
      ${count} = ${count} + 1
    WHERE id = ${rateeId}::uuid
  `);
}
