import { AppError } from '../../../shared/errors/AppError.js';

interface CreatedAtIdCursor {
  createdAt: string;
  id: string;
}

function isCursorShape(value: unknown): value is { createdAt: unknown; id: unknown } {
  return typeof value === 'object' && value !== null && 'createdAt' in value && 'id' in value;
}

// claude.md §26/§81: opaque cursor, base64url(JSON) — same shape/reasoning
// as notificationCursor.ts, reused here for both conversation and message
// listing (both are fixed newest-first order, no client-selectable sort).
export function encodeChatCursor(cursor: CreatedAtIdCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeChatCursor(raw: string): CreatedAtIdCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  if (!isCursorShape(parsed) || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  return { createdAt: parsed.createdAt, id: parsed.id };
}
