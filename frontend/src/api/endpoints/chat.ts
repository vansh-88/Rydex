import { apiRequest, withQuery } from '@/api/client';
import type { Conversation, Message, Paginated } from '@/api/types';

// REST covers history only — sending happens over the socket (see
// features/chat/socket.ts). Both lists come back newest-first.
export function listConversations(
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<Conversation>> {
  return apiRequest(withQuery('/conversations', { cursor }), { signal });
}

export function listMessages(
  conversationId: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<Message>> {
  return apiRequest(withQuery(`/conversations/${conversationId}/messages`, { cursor }), { signal });
}
