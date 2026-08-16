import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  SupportConversationStatus,
  SupportMessageRole,
  SupportMessageStatus,
} from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface SupportConversationRecord {
  id: string;
  userId: string;
  status: SupportConversationStatus;
  escalationReason: string | null;
  escalatedAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportMessageRecord {
  id: string;
  conversationId: string;
  role: SupportMessageRole;
  content: string | null;
  toolCallId: string | null;
  toolName: string | null;
  toolArguments: Prisma.JsonValue | null;
  toolCalls: Prisma.JsonValue | null;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  status: SupportMessageStatus;
  errorCode: string | null;
  createdAt: Date;
}

// claude.md §96.5: a support conversation is scoped to a user, no
// ride/booking association — created eagerly the moment the first message
// is sent (POST /support/conversations), unlike the passenger-driver
// Conversation (§47), which is created lazily off a booking event.
export async function createConversation(userId: string): Promise<SupportConversationRecord> {
  return prisma.supportConversation.create({ data: { userId, lastMessageAt: new Date() } });
}

export async function findConversationById(id: string): Promise<SupportConversationRecord | null> {
  return prisma.supportConversation.findUnique({ where: { id } });
}

export async function touchConversation(id: string): Promise<void> {
  await prisma.supportConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
}

export interface ConversationListCursor {
  lastMessageAt: string;
  id: string;
}

// claude.md §54: scoped to the caller's own conversations only, same
// reasoning as chat/notification list queries.
export async function listConversationsByUser(
  userId: string,
  cursor: ConversationListCursor | null,
  limit: number,
): Promise<SupportConversationRecord[]> {
  return prisma.supportConversation.findMany({
    where: {
      userId,
      ...(cursor
        ? {
            OR: [
              { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
              { lastMessageAt: new Date(cursor.lastMessageAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
}

// All fields plainly optional (never `| null`, per `exactOptionalPropertyTypes` —
// see infrastructure/fcm/firebasePushProvider.ts's comment for the same
// convention) — omitted means "leave the nullable DB column at its default
// (NULL)", never an explicit `undefined` assignment.
export interface CreateMessageInput {
  conversationId: string;
  role: SupportMessageRole;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  status?: SupportMessageStatus;
  errorCode?: string;
}

export async function createMessage(input: CreateMessageInput): Promise<SupportMessageRecord> {
  return prisma.supportMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.toolCallId !== undefined ? { toolCallId: input.toolCallId } : {}),
      ...(input.toolName !== undefined ? { toolName: input.toolName } : {}),
      ...(input.toolArguments !== undefined
        ? { toolArguments: input.toolArguments as Prisma.InputJsonValue }
        : {}),
      ...(input.toolCalls !== undefined
        ? { toolCalls: input.toolCalls as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.promptTokens !== undefined ? { promptTokens: input.promptTokens } : {}),
      ...(input.completionTokens !== undefined ? { completionTokens: input.completionTokens } : {}),
      status: input.status ?? 'COMPLETED',
      ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
    },
  });
}

export interface MessageListCursor {
  createdAt: string;
  id: string;
}

// claude.md §26/§81: newest-first cursor page, for API display — same
// shape as chat/notification message history.
export async function listMessagesByConversation(
  conversationId: string,
  cursor: MessageListCursor | null,
  limit: number,
): Promise<SupportMessageRecord[]> {
  return prisma.supportMessage.findMany({
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

// claude.md §10 (context strategy): chronological order, most recent
// `limit` messages — distinct from listMessagesByConversation above (which
// is newest-first, for API display). Only COMPLETED rows are sent back to
// the model as history; a FAILED turn's placeholder (no real assistant
// content) would otherwise poison the next prompt.
export async function listRecentMessagesForContext(
  conversationId: string,
  limit: number,
): Promise<SupportMessageRecord[]> {
  const rows = await prisma.supportMessage.findMany({
    where: { conversationId, status: 'COMPLETED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.reverse();
}
