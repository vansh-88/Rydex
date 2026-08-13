import type { Server, Socket } from 'socket.io';

import { env } from '../../../config/env.js';
import type { UserRole } from '../../../generated/prisma/enums.js';
import { consumeRateLimit } from '../../../infrastructure/redis/rateLimit.js';
import { verifyAccessToken } from '../../auth/services/tokenService.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { joinConversationPayloadSchema, sendMessagePayloadSchema } from '../schemas/chatSchemas.js';
import * as conversationService from '../services/conversationService.js';
import type { MessageDto } from '../services/conversationService.js';

interface SocketUser {
  id: string;
  role: UserRole;
}

type Ack = ((response: { ok: true; data?: MessageDto } | { ok: false; error: string }) => void) | undefined;

function socketUser(socket: Socket): SocketUser {
  return socket.data as SocketUser;
}

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function extractToken(socket: Socket): string | undefined {
  const authToken: unknown = socket.handshake.auth.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return undefined;
}

function errorCode(err: unknown): string {
  return err instanceof AppError ? err.code : 'INTERNAL_ERROR';
}

// claude.md §47 WebSocket flow: connect -> authenticate -> authorize -> join
// conversation -> send message -> persist -> emit. "Do not allow a user to
// join arbitrary conversation IDs" / "Do not trust conversation IDs from the
// client" — every join_conversation and send_message call re-checks
// participant membership server-side (conversationService.authorizeParticipant),
// never trusting that a prior join happened.
export function registerChatGateway(io: Server): void {
  io.use((socket, next) => {
    const token = extractToken(socket);
    if (token === undefined) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    // claude.md §49 lists "WebSocket connection" as its own rate-limit
    // category. Applied after authentication so the limit is keyed to a real
    // user rather than a spoofable IP — and so an unauthenticated flood is
    // rejected by the cheaper check first. Shares the Redis-backed limiter
    // used by every HTTP route (§66: the limit must hold across instances,
    // and a socket can land on any of them).
    consumeRateLimit(
      'ws-connect-user',
      payload.sub,
      env.WS_CONNECT_RATE_LIMIT_WINDOW_SECONDS,
      env.WS_CONNECT_RATE_LIMIT_MAX,
    )
      .then((result) => {
        if (!result.allowed) {
          next(new Error('RATE_LIMITED'));
          return;
        }
        socket.data = { id: payload.sub, role: payload.role } satisfies SocketUser;
        next();
      })
      .catch(() => {
        next(new Error('INTERNAL_ERROR'));
      });
  });

  io.on('connection', (socket: Socket) => {
    const user = socketUser(socket);

    socket.on('join_conversation', (raw: unknown, ack: Ack) => {
      const parsed = joinConversationPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'VALIDATION_ERROR' });
        return;
      }

      conversationService
        .authorizeParticipant(user.id, parsed.data.conversationId)
        .then(async () => {
          await socket.join(roomName(parsed.data.conversationId));
          ack?.({ ok: true });
        })
        .catch((err: unknown) => {
          ack?.({ ok: false, error: errorCode(err) });
        });
    });

    // An authenticated socket could otherwise write to the messages table as
    // fast as it can emit. The connection limit above only bounds how often
    // a user *connects*, not what they do once connected, so message sending
    // needs its own bucket.
    socket.on('send_message', (raw: unknown, ack: Ack) => {
      const parsed = sendMessagePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'VALIDATION_ERROR' });
        return;
      }

      consumeRateLimit(
        'ws-message-user',
        user.id,
        env.WS_MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
        env.WS_MESSAGE_RATE_LIMIT_MAX,
      )
        .then(async (result) => {
          if (!result.allowed) {
            ack?.({ ok: false, error: 'RATE_LIMITED' });
            return;
          }

          const message = await conversationService.sendMessage(
            user.id,
            parsed.data.conversationId,
            parsed.data.message,
          );
          io.to(roomName(parsed.data.conversationId)).emit('message', message);
          ack?.({ ok: true, data: message });
        })
        .catch((err: unknown) => {
          ack?.({ ok: false, error: errorCode(err) });
        });
    });
  });
}
