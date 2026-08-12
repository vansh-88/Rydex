import { prisma } from '../../../infrastructure/database/prismaClient.js';
import { bookingExpiryQueue } from '../../../infrastructure/queue/queues.js';
import * as rideRepository from '../../ride/repositories/rideRepository.js';
import * as bookingRepository from '../repositories/bookingRepository.js';

export interface BookingExpiryJobData {
  bookingId: string;
}

const EXPIRE_BOOKING_JOB_NAME = 'expire-booking';

// claude.md §35: scheduled once, right after a PENDING_PAYMENT booking is
// created. `jobId: bookingId` makes re-scheduling for the same booking a
// no-op rather than a duplicate delayed job.
export async function scheduleBookingExpiry(bookingId: string, delaySeconds: number): Promise<void> {
  await bookingExpiryQueue.add(
    EXPIRE_BOOKING_JOB_NAME,
    { bookingId } satisfies BookingExpiryJobData,
    { delay: delaySeconds * 1000, jobId: bookingId },
  );
}

// claude.md §36: the conditional update inside bookingRepository.expireIfPending
// only matches status = PENDING_PAYMENT, so this is a no-op if the booking
// was already confirmed/cancelled by the time the job fires — the job can
// safely run more than once (BullMQ retry, manual re-trigger, etc.) without
// ever releasing a seat out from under a booking that's no longer pending.
export async function processBookingExpiry(bookingId: string): Promise<void> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const expired = await bookingRepository.expireIfPending(tx, bookingId);
    if (expired) {
      await rideRepository.releaseSeats(tx, booking.rideId, booking.seatCount);
    }
  });
}

// §97 (2026-08-13): once a booking reaches a terminal-for-the-TTL's-purpose
// state (confirmed via webhook, failed via webhook, or manually cancelled by
// the passenger), the scheduled expiry job is pure waste — it'll no-op
// against processBookingExpiry's own idempotency check anyway, but removing
// it outright avoids that wasted work at scale. Best-effort: a job that's
// already running or already fired can't be un-removed, which is fine since
// the no-op path handles that case correctly regardless.
export async function cancelScheduledBookingExpiry(bookingId: string): Promise<void> {
  await bookingExpiryQueue.remove(bookingId).catch((err: unknown) => {
    console.error(`Failed to remove booking-expiry job for booking ${bookingId}:`, err);
  });
}
