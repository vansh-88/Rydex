import { z } from 'zod';

export const listConversationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

// claude.md §47: WebSocket payload shapes — validated manually in the socket
// gateway (Express's validateBody middleware doesn't apply to socket events).
export const joinConversationPayloadSchema = z.object({
  conversationId: z.string().uuid(),
});

export const sendMessagePayloadSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});
