import type { Prisma } from '../../../generated/prisma/client.js';
import type { NotificationType } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateNotificationInput {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: Date | null;
  createdAt: Date;
}

function toNotificationRecord(row: {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data as Record<string, string> | null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

// claude.md §43 "idempotent job handling": the caller (notificationService)
// passes a deterministic `id` generated once at enqueue time, so a BullMQ
// retry re-running this job finds the row already there (the `update: {}`
// branch is a pure no-op) instead of inserting a duplicate.
export async function upsert(input: CreateNotificationInput): Promise<NotificationRecord> {
  const row = await prisma.notification.upsert({
    where: { id: input.id },
    update: {},
    create: {
      id: input.id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      // `exactOptionalPropertyTypes`: omit the key entirely for "no data"
      // rather than pass `data: undefined`.
      ...(input.data ? { data: input.data } : {}),
    },
  });
  return toNotificationRecord(row);
}

export interface NotificationListCursor {
  createdAt: string;
  id: string;
}

// claude.md §81: list responses are {items, nextCursor}. Always newest-first
// — unlike ride search (§25/§26), there's no client-selectable sort here, so
// a single fixed keyset (createdAt desc, id desc) is all this needs.
export async function listByUser(
  userId: string,
  cursor: NotificationListCursor | null,
  limit: number,
): Promise<NotificationRecord[]> {
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map(toNotificationRecord);
}

// claude.md §54: a user may only ever read/mark-read their own notifications
// — scoped by userId in the WHERE clause, not checked after the fact.
// Idempotent: marking an already-read notification as read again is a
// no-op that still returns the (unchanged) record, not an error — only a
// genuinely missing/not-owned notification is null.
export async function markRead(userId: string, id: string): Promise<NotificationRecord | null> {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  if (existing.readAt !== null) {
    return toNotificationRecord(existing);
  }
  const updated = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return toNotificationRecord(updated);
}
