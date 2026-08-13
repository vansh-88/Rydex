import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface ConversationRecord {
  id: string;
  rideId: string;
  driverId: string;
  passengerId: string;
  createdAt: Date;
}

// claude.md §47: one conversation per (rideId, passengerId) pair — created
// lazily the first time a passenger has a reason to talk to the driver
// (bookingService.createBooking calls this after a booking is created).
// Idempotent by the (rideId, passengerId) unique constraint, so a second
// booking by the same passenger on the same ride reuses the existing
// conversation rather than creating a duplicate one.
export async function findOrCreate(
  rideId: string,
  driverId: string,
  passengerId: string,
): Promise<ConversationRecord> {
  return prisma.conversation.upsert({
    where: { rideId_passengerId: { rideId, passengerId } },
    update: {},
    create: { rideId, driverId, passengerId },
  });
}

export async function findById(id: string): Promise<ConversationRecord | null> {
  return prisma.conversation.findUnique({ where: { id } });
}

export interface ConversationListCursor {
  createdAt: string;
  id: string;
}

export interface ConversationListRow extends ConversationRecord {
  driverName: string;
  passengerName: string;
  lastMessage: { message: string; senderId: string; createdAt: Date } | null;
}

// claude.md §54: scoped to conversations the caller actually participates in
// (as driver or passenger) — never a global conversation list.
export async function listForUser(
  userId: string,
  cursor: ConversationListCursor | null,
  limit: number,
): Promise<ConversationListRow[]> {
  const rows = await prisma.conversation.findMany({
    where: {
      AND: [
        { OR: [{ driverId: userId }, { passengerId: userId }] },
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.createdAt) } },
                  { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      driver: { select: { name: true } },
      passenger: { select: { name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    rideId: row.rideId,
    driverId: row.driverId,
    passengerId: row.passengerId,
    createdAt: row.createdAt,
    driverName: row.driver.name,
    passengerName: row.passenger.name,
    lastMessage: row.messages[0]
      ? { message: row.messages[0].message, senderId: row.messages[0].senderId, createdAt: row.messages[0].createdAt }
      : null,
  }));
}
