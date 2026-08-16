import { z } from 'zod';

import { env } from '../../../config/env.js';

export const createConversationSchema = z.object({
  message: z.string().trim().min(1).max(env.SUPPORT_CHAT_MAX_MESSAGE_LENGTH),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const postMessageSchema = z.object({
  message: z.string().trim().min(1).max(env.SUPPORT_CHAT_MAX_MESSAGE_LENGTH),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const listConversationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const getConversationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type GetConversationQuery = z.infer<typeof getConversationQuerySchema>;
