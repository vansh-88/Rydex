import { io, type Socket } from 'socket.io-client';

import { forceTokenRefresh } from '@/api/client';
import type { Message } from '@/api/types';
import { tokenStore } from '@/auth/tokenStore';

// The backend runs a Socket.IO server on the same origin, and the Vite dev
// server proxies /socket.io with ws:true — so a default-path connection is
// same-origin in both dev and production.

interface ServerToClient {
  // Broadcast to everyone in the room *including the sender*, which is why
  // the UI never optimistically appends its own message: doing so would show
  // it twice.
  message: (message: Message) => void;
}

interface ClientToServer {
  join_conversation: (
    payload: { conversationId: string },
    ack: (response: { ok: boolean; error?: string }) => void,
  ) => void;
  send_message: (
    payload: { conversationId: string; message: string },
    ack: (response: { ok: boolean; data?: Message; error?: string }) => void,
  ) => void;
}

export type ChatSocket = Socket<ServerToClient, ClientToServer>;

let socket: ChatSocket | null = null;

export function getChatSocket(): ChatSocket {
  if (socket !== null) return socket;

  socket = io({
    // A callback rather than a fixed object: socket.io calls it again on every
    // reconnect, so a token refreshed since the last attempt is picked up
    // automatically instead of the socket retrying with a dead one.
    auth: (cb: (data: { token: string | null }) => void) => {
      cb({ token: tokenStore.getAccessToken() });
    },
    // The REST layer already refreshes tokens on demand; leaving this to
    // socket.io's own backoff keeps reconnection in one place.
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // The access token is short-lived, so a reconnect after a quiet period will
  // often fail auth. Refresh once and let socket.io retry with the new token.
  socket.on('connect_error', (error: Error) => {
    if (error.message === 'UNAUTHORIZED') {
      void forceTokenRefresh().catch(() => undefined);
    }
  });

  return socket;
}

export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
}

// Promise wrappers around the ack-callback API, so callers can await them.
export function joinConversation(conversationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getChatSocket().emit('join_conversation', { conversationId }, (response) => {
      if (response.ok) resolve();
      else reject(new Error(response.error ?? 'INTERNAL_ERROR'));
    });
  });
}

export function sendChatMessage(conversationId: string, message: string): Promise<Message> {
  return new Promise((resolve, reject) => {
    getChatSocket().emit('send_message', { conversationId, message }, (response) => {
      if (response.ok && response.data !== undefined) resolve(response.data);
      else reject(new Error(response.error ?? 'INTERNAL_ERROR'));
    });
  });
}

// Socket error codes are a small, fixed set — mapped here rather than reusing
// the REST error copy, which is keyed on a different vocabulary.
export function chatErrorCopy(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'RATE_LIMITED':
      return 'You are sending messages too quickly. Wait a moment.';
    case 'CONVERSATION_NOT_FOUND':
      return 'This conversation is no longer available.';
    case 'VALIDATION_ERROR':
      return 'Messages must be between 1 and 2000 characters.';
    case 'UNAUTHORIZED':
      return 'Your session expired. Reload the page to continue.';
    default:
      return 'Message could not be sent. Try again.';
  }
}
