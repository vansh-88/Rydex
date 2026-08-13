import { AppError } from '../../../shared/errors/AppError.js';

// claude.md §26/§81: opaque cursor, base64url(JSON) — same shape/reasoning
// as chatCursor.ts/notificationCursor.ts, generalized slightly (a keyed
// field list) since this module needs two different cursor shapes
// (conversations by lastMessageAt, messages by createdAt) rather than one.
function encode(cursor: Record<string, string>): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decode(raw: string, keys: string[]): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  const obj = parsed as Record<string, unknown>;
  for (const key of keys) {
    if (typeof obj[key] !== 'string') {
      throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
    }
  }
  return obj as Record<string, string>;
}

export function encodeConversationCursor(cursor: { lastMessageAt: string; id: string }): string {
  return encode(cursor);
}

export function decodeConversationCursor(raw: string): { lastMessageAt: string; id: string } {
  const obj = decode(raw, ['lastMessageAt', 'id']);
  return { lastMessageAt: obj.lastMessageAt!, id: obj.id! };
}

export function encodeMessageCursor(cursor: { createdAt: string; id: string }): string {
  return encode(cursor);
}

export function decodeMessageCursor(raw: string): { createdAt: string; id: string } {
  const obj = decode(raw, ['createdAt', 'id']);
  return { createdAt: obj.createdAt!, id: obj.id! };
}
