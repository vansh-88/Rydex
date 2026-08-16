import { AppError } from '../../../shared/errors/AppError.js';
import type { NotificationListCursor } from '../repositories/notificationRepository.js';

function isCursorShape(value: unknown): value is { createdAt: unknown; id: unknown } {
  return typeof value === 'object' && value !== null && 'createdAt' in value && 'id' in value;
}

// claude.md §26/§81: opaque cursor, base64url(JSON) — no raw SQL/internal
// query state exposed. Simpler than ride search's (rideSearchCursor.ts):
// notification listing has exactly one fixed order (newest first), so there
// is no `sort` field to round-trip/validate against.
export function encodeNotificationCursor(cursor: NotificationListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeNotificationCursor(raw: string): NotificationListCursor {
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
