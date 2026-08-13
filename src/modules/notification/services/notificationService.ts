import { randomUUID } from 'node:crypto';

import type { DevicePlatform, NotificationType } from '../../../generated/prisma/enums.js';
import { pushProvider } from '../../../infrastructure/fcm/index.js';
import { notificationQueue } from '../../../infrastructure/queue/queues.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import type { NotificationRecord } from '../repositories/notificationRepository.js';
import * as userDeviceRepository from '../repositories/userDeviceRepository.js';
import { decodeNotificationCursor, encodeNotificationCursor } from './notificationCursor.js';

export interface NotificationJobData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
}

const DELIVER_NOTIFICATION_JOB_NAME = 'deliver-notification';

// claude.md §42: "Business Module -> Event/Job -> BullMQ -> Notification
// Worker -> FCM" — every notify* function below funnels through here. The
// `id` is generated once, at enqueue time, and carried through the whole
// job so processNotificationJob's persistence step is idempotent against
// BullMQ retries (claude.md §43).
async function enqueueNotification(input: Omit<NotificationJobData, 'id'>): Promise<void> {
  const id = randomUUID();
  await notificationQueue.add(
    DELIVER_NOTIFICATION_JOB_NAME,
    { id, ...input } satisfies NotificationJobData,
    { jobId: id, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
  );
}

// claude.md §44: one function per notification type, each owning its own
// title/body copy — keeps message content next to the context that knows
// the values needed to phrase it, rather than a generic template registry
// with a single call site apiece (§86: no abstraction with no current use).

export async function notifyRideBooked(driverId: string, rideId: string, seatCount: number): Promise<void> {
  await enqueueNotification({
    userId: driverId,
    type: 'RIDE_BOOKED',
    title: 'New booking',
    body: `A passenger booked ${seatCount} seat${seatCount === 1 ? '' : 's'} on your ride.`,
    data: { rideId },
  });
}

export async function notifyBookingConfirmed(passengerId: string, bookingId: string, rideId: string): Promise<void> {
  await enqueueNotification({
    userId: passengerId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Your seat is confirmed. Have a great ride!',
    data: { bookingId, rideId },
  });
}

export async function notifyBookingCancelled(passengerId: string, bookingId: string): Promise<void> {
  await enqueueNotification({
    userId: passengerId,
    type: 'BOOKING_CANCELLED',
    title: 'Booking cancelled',
    body: 'Your booking has been cancelled.',
    data: { bookingId },
  });
}

export async function notifyRideCancelled(passengerId: string, rideId: string): Promise<void> {
  await enqueueNotification({
    userId: passengerId,
    type: 'RIDE_CANCELLED',
    title: 'Ride cancelled',
    body: 'The driver has cancelled this ride.',
    data: { rideId },
  });
}

export async function notifyRideStarting(passengerId: string, rideId: string): Promise<void> {
  await enqueueNotification({
    userId: passengerId,
    type: 'RIDE_STARTING',
    title: 'Ride starting',
    body: 'Your ride is starting now.',
    data: { rideId },
  });
}

export async function notifyRideCompleted(passengerId: string, rideId: string): Promise<void> {
  await enqueueNotification({
    userId: passengerId,
    type: 'RIDE_COMPLETED',
    title: 'Ride completed',
    body: 'Your ride has been completed. Thanks for riding with Rydex!',
    data: { rideId },
  });
}

export async function notifyPaymentSuccess(
  userId: string,
  amount: number,
  reference: { rideId: string | null; bookingId: string | null },
): Promise<void> {
  await enqueueNotification({
    userId,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment successful',
    body: `Your payment of ₹${amount} was successful.`,
    data: {
      ...(reference.rideId ? { rideId: reference.rideId } : {}),
      ...(reference.bookingId ? { bookingId: reference.bookingId } : {}),
    },
  });
}

export async function notifyPaymentFailed(
  userId: string,
  amount: number,
  reference: { rideId: string | null; bookingId: string | null },
): Promise<void> {
  await enqueueNotification({
    userId,
    type: 'PAYMENT_FAILED',
    title: 'Payment failed',
    body: `Your payment of ₹${amount} could not be completed.`,
    data: {
      ...(reference.rideId ? { rideId: reference.rideId } : {}),
      ...(reference.bookingId ? { bookingId: reference.bookingId } : {}),
    },
  });
}

export async function notifyRefundProcessed(userId: string, amount: number): Promise<void> {
  await enqueueNotification({
    userId,
    type: 'REFUND_PROCESSED',
    title: 'Refund processed',
    body: `₹${amount} has been refunded to you.`,
    data: {},
  });
}

// claude.md §46: persistence and FCM delivery are separate concerns. The
// upsert makes persistence idempotent; the send() call is left to throw on
// a genuine gateway failure so BullMQ retries the whole job (the retry's
// persistence step is then a no-op, per the upsert above) rather than
// silently swallowing a transient FCM outage.
export async function processNotificationJob(job: NotificationJobData): Promise<void> {
  await notificationRepository.upsert({
    id: job.id,
    userId: job.userId,
    type: job.type,
    title: job.title,
    body: job.body,
    data: job.data,
  });

  const tokens = await userDeviceRepository.findTokensByUserId(job.userId);
  if (tokens.length === 0) {
    return;
  }

  const results = await pushProvider.send(tokens, {
    title: job.title,
    body: job.body,
    ...(job.data ? { data: job.data } : {}),
  });

  // claude.md §45: act on FCM's per-token "this token is dead" signal.
  const invalidTokens = results.filter((r) => r.invalidToken).map((r) => r.token);
  if (invalidTokens.length > 0) {
    await userDeviceRepository.removeTokens(invalidTokens);
  }
}

export async function registerDevice(userId: string, deviceToken: string, platform: DevicePlatform): Promise<void> {
  await userDeviceRepository.upsertDevice(userId, deviceToken, platform);
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

function toNotificationDto(notification: NotificationRecord): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

export async function listNotifications(
  userId: string,
  cursorRaw: string | undefined,
  limitRaw: number | undefined,
): Promise<{ items: NotificationDto[]; nextCursor: string | null }> {
  const limit = Math.min(limitRaw ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const cursor = cursorRaw !== undefined ? decodeNotificationCursor(cursorRaw) : null;

  const rows = await notificationRepository.listByUser(userId, cursor, limit);
  const items = rows.map(toNotificationDto);

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeNotificationCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null;

  return { items, nextCursor };
}

export async function markNotificationRead(userId: string, id: string): Promise<NotificationDto> {
  const updated = await notificationRepository.markRead(userId, id);
  if (!updated) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return toNotificationDto(updated);
}
