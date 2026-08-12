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
