import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  message: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export async function create(input: CreateMessageInput): Promise<MessageRecord> {
  return prisma.message.create({ data: input });
}

export interface MessageListCursor {
  createdAt: string;
  id: string;
}

// claude.md §47/§81: newest-first, same fixed-keyset cursor shape as
// notificationRepository.listByUser — chat has no client-selectable sort
// either.
export async function listByConversation(
  conversationId: string,
  cursor: MessageListCursor | null,
  limit: number,
): Promise<MessageRecord[]> {
  return prisma.message.findMany({
    where: {
      conversationId,
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
}
