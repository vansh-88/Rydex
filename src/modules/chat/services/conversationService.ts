import { AppError } from '../../../shared/errors/AppError.js';
import * as conversationRepository from '../repositories/conversationRepository.js';
import type { ConversationRecord } from '../repositories/conversationRepository.js';
import * as messageRepository from '../repositories/messageRepository.js';
import type { MessageRecord } from '../repositories/messageRepository.js';
import { decodeChatCursor, encodeChatCursor } from './chatCursor.js';

// claude.md §47: "A conversation is associated with a ride" — created
// lazily the moment a passenger has a reason to talk to the driver.
// bookingService.createBooking calls this after a booking is created; not
// gated on booking/payment status, since either party may want to talk
// before payment confirms.
export async function getOrCreateConversationForRide(
  rideId: string,
  driverId: string,
  passengerId: string,
): Promise<ConversationRecord> {
  return conversationRepository.findOrCreate(rideId, driverId, passengerId);
}

// claude.md §47: "Do not trust conversation IDs from the client" / "Do not
// allow a user to join arbitrary conversation IDs." Called on every socket
// join AND every send — never relies on a prior join having authorized
// anything. Not-found and not-a-participant both surface as the same
// 404 CONVERSATION_NOT_FOUND, matching this codebase's existing
// "don't leak existence to non-participants" pattern (bookingService,
// vehicleService).
export async function authorizeParticipant(userId: string, conversationId: string): Promise<ConversationRecord> {
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation || (conversation.driverId !== userId && conversation.passengerId !== userId)) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
  }
  return conversation;
}

export interface ConversationDto {
  id: string;
  rideId: string;
  counterpart: { id: string; name: string };
  lastMessage: { message: string; senderId: string; createdAt: string } | null;
  createdAt: string;
}

function toConversationDto(userId: string, row: conversationRepository.ConversationListRow): ConversationDto {
  const isDriver = row.driverId === userId;
  return {
    id: row.id,
    rideId: row.rideId,
    counterpart: isDriver
      ? { id: row.passengerId, name: row.passengerName }
      : { id: row.driverId, name: row.driverName },
    lastMessage: row.lastMessage
      ? {
          message: row.lastMessage.message,
          senderId: row.lastMessage.senderId,
          createdAt: row.lastMessage.createdAt.toISOString(),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

export async function listConversations(
  userId: string,
  cursorRaw: string | undefined,
  limitRaw: number | undefined,
): Promise<{ items: ConversationDto[]; nextCursor: string | null }> {
  const limit = Math.min(limitRaw ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const cursor = cursorRaw !== undefined ? decodeChatCursor(cursorRaw) : null;

  const rows = await conversationRepository.listForUser(userId, cursor, limit);
  const items = rows.map((row) => toConversationDto(userId, row));

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last ? encodeChatCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return { items, nextCursor };
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

function toMessageDto(message: MessageRecord): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    message: message.message,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function listMessages(
  userId: string,
  conversationId: string,
  cursorRaw: string | undefined,
  limitRaw: number | undefined,
): Promise<{ items: MessageDto[]; nextCursor: string | null }> {
  await authorizeParticipant(userId, conversationId);

  const limit = Math.min(limitRaw ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const cursor = cursorRaw !== undefined ? decodeChatCursor(cursorRaw) : null;

  const rows = await messageRepository.listByConversation(conversationId, cursor, limit);
  const items = rows.map(toMessageDto);

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last ? encodeChatCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return { items, nextCursor };
}

const MESSAGE_MAX_LENGTH = 2000;

// claude.md §47 WebSocket flow: "authorize -> ... -> send message -> persist
// -> emit". Authorization happens here (not just at join time) since a
// client could emit send_message without ever having joined.
export async function sendMessage(userId: string, conversationId: string, message: string): Promise<MessageDto> {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', `Message must be 1-${MESSAGE_MAX_LENGTH} characters`);
  }

  await authorizeParticipant(userId, conversationId);

  const created = await messageRepository.create({ conversationId, senderId: userId, message: trimmed });
  return toMessageDto(created);
}
