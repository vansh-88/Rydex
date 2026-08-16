import type { RatingRole } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { getUniqueConstraintFields } from '../../../infrastructure/database/prismaErrors.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as bookingRepository from '../../booking/repositories/bookingRepository.js';
import type { BookingRecord } from '../../booking/repositories/bookingRepository.js';
import * as rideRepository from '../../ride/repositories/rideRepository.js';
import type { RideRecord } from '../../ride/repositories/rideRepository.js';
import * as ratingRepository from '../repositories/ratingRepository.js';
import type { RatingRecord } from '../repositories/ratingRepository.js';
import type { SubmitRatingInput } from '../schemas/ratingSchemas.js';

export interface RatingDto {
  id: string;
  rideId: string;
  bookingId: string;
  raterId: string;
  rateeId: string;
  rateeRole: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

function toRatingDto(rating: RatingRecord): RatingDto {
  return {
    id: rating.id,
    rideId: rating.rideId,
    bookingId: rating.bookingId,
    raterId: rating.raterId,
    rateeId: rating.rateeId,
    rateeRole: rating.rateeRole,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
  };
}

interface ParticipantContext {
  booking: BookingRecord;
  ride: RideRecord;
  // Who this caller would be rating, derived — never supplied by the client.
  rateeId: string;
  rateeRole: RatingRole;
}

/**
 * Authorization only: is the caller a participant in this booking, and which
 * direction would they be rating in?
 *
 * A passenger on the booking rates the ride's driver; that ride's driver rates
 * the passenger. Anyone else gets 404 rather than 403 — "exists but isn't
 * yours" and "doesn't exist" must be indistinguishable, or the endpoint becomes
 * a probe for valid booking ids. Same pattern as bookingService.getBooking
 * (claude.md §54).
 */
async function authorizeParticipant(userId: string, bookingId: string): Promise<ParticipantContext> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }

  const ride = await rideRepository.findById(booking.rideId);
  if (!ride) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }

  if (booking.passengerId === userId) {
    return { booking, ride, rateeId: ride.driverId, rateeRole: 'DRIVER' };
  }
  if (ride.driverId === userId) {
    return { booking, ride, rateeId: booking.passengerId, rateeRole: 'PASSENGER' };
  }

  throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
}

/**
 * Separate from authorization on purpose: reading ratings is allowed whenever
 * you are a participant, but *submitting* one additionally requires the trip to
 * have actually happened.
 */
function assertRateable(context: ParticipantContext): void {
  // Gated on the *ride* reaching COMPLETED rather than the booking. A booking
  // only reaches COMPLETED when its final-payment webhook succeeds
  // (bookingRepository.completeBooking), and no reconciliation job exists to
  // recover a payment whose webhook never arrived — so gating on the booking
  // would let a payment failure make a ride permanently unrateable for a
  // passenger who did nothing wrong.
  if (context.ride.status !== 'COMPLETED') {
    throw new AppError(409, 'RIDE_NOT_COMPLETED', 'This ride has not been completed yet');
  }

  // A cancelled or payment-failed booking never actually shared the trip, so
  // there is nothing to rate even though the ride itself completed.
  if (context.booking.status !== 'CONFIRMED' && context.booking.status !== 'COMPLETED') {
    throw new AppError(409, 'BOOKING_NOT_RATEABLE', 'This booking cannot be rated');
  }
}

// The composite unique index is (booking_id, rater_id); the pg driver adapter
// reports DB column names, older Prisma shapes report field names. Accept both,
// same defensiveness as getUniqueConstraintFields itself.
function isDuplicateRating(err: unknown): boolean {
  const fields = getUniqueConstraintFields(err);
  return fields.includes('rater_id') || fields.includes('raterId');
}

export async function submitRating(
  userId: string,
  bookingId: string,
  input: SubmitRatingInput,
): Promise<RatingDto> {
  const context = await authorizeParticipant(userId, bookingId);
  assertRateable(context);

  try {
    // Insert and aggregate commit together: if the unique constraint rejects a
    // duplicate, the aggregate update rolls back with it, so a retry can never
    // count a score twice (claude.md §58/§84).
    const rating = await prisma.$transaction(async (tx) => {
      const created = await ratingRepository.create(tx, {
        rideId: context.ride.id,
        bookingId,
        raterId: userId,
        rateeId: context.rateeId,
        rateeRole: context.rateeRole,
        score: input.score,
        comment: input.comment ?? null,
      });

      await ratingRepository.applyToAggregate(tx, context.rateeId, context.rateeRole, input.score);

      return created;
    });

    return toRatingDto(rating);
  } catch (err) {
    // Unlike the payment endpoints, a repeat submission is *rejected* rather
    // than replayed. A rating is a one-time opinion, not a retryable side
    // effect — silently returning the original would hide that the second
    // score was discarded.
    if (isDuplicateRating(err)) {
      throw new AppError(409, 'ALREADY_RATED', 'You have already rated this booking');
    }
    throw err;
  }
}

/**
 * Ratings on a booking, scoped to what the caller is entitled to see: the one
 * they gave and the one they received. A booking only ever has two
 * participants, so that is currently the whole set — filtering explicitly means
 * a future third party can't silently widen the exposure.
 *
 * Exists so a client can tell whether it has already rated, instead of finding
 * out through a 409.
 */
export async function listRatingsForBooking(
  userId: string,
  bookingId: string,
): Promise<RatingDto[]> {
  await authorizeParticipant(userId, bookingId);

  const ratings = await ratingRepository.findByBookingId(bookingId);
  return ratings
    .filter((rating) => rating.raterId === userId || rating.rateeId === userId)
    .map(toRatingDto);
}
