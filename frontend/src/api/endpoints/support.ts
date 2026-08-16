import { apiRequest, withQuery } from '@/api/client';
import type { Paginated, SupportConversation, SupportMessage } from '@/api/types';

// The backend caps a message at SUPPORT_CHAT_MAX_MESSAGE_LENGTH (2000) and
// rate-limits to 10/min and 50/day per user.
export const SUPPORT_MAX_MESSAGE_LENGTH = 2000;

// Starting a conversation returns the assistant's first reply in the same
// response — the request is synchronous through the model.
export function startSupportConversation(
  message: string,
): Promise<{ conversation: SupportConversation; reply: SupportMessage }> {
  return apiRequest('/support/conversations', { method: 'POST', body: { message } });
}

export function listSupportConversations(
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<SupportConversation>> {
  return apiRequest(withQuery('/support/conversations', { cursor }), { signal });
}

export function getSupportConversation(
  conversationId: string,
  signal?: AbortSignal,
): Promise<{ conversation: SupportConversation; messages: Paginated<SupportMessage> }> {
  return apiRequest(`/support/conversations/${conversationId}`, { signal });
}

export function sendSupportMessage(
  conversationId: string,
  message: string,
): Promise<SupportMessage> {
  return apiRequest(`/support/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { message },
  });
}
