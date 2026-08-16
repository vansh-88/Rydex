import { AppError } from '../errors/AppError.js';

// A keyset cursor over a (timestamp, id) pair — the same opaque
// base64url(JSON) shape claude.md §26/§81 already mandates, generalised so a
// list ordered by any timestamp column can use it.
//
// chatCursor.ts and notificationCursor.ts predate this and are deliberately
// left alone: both are hard-wired to `createdAt` and rewriting working,
// verified code is not part of this change. New paginated lists should use
// this instead of adding a fourth near-identical copy. rideSearchCursor.ts is
// genuinely different (it round-trips a `sort` field and validates it against
// the request) and is not a candidate for consolidation.
export interface KeysetCursor {
  // ISO-8601 timestamp of the ordering column on the last row of the page.
  value: string;
  // Tiebreaker — ids are unique, so (value, id) is a total order.
  id: string;
}

function isCursorShape(value: unknown): value is { value: unknown; id: unknown } {
  return typeof value === 'object' && value !== null && 'value' in value && 'id' in value;
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeKeysetCursor(raw: string): KeysetCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  if (!isCursorShape(parsed) || typeof parsed.value !== 'string' || typeof parsed.id !== 'string') {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  // A cursor whose timestamp doesn't parse would silently become an
  // `Invalid Date` in the WHERE clause and match nothing — reject it here so
  // the client gets INVALID_CURSOR rather than a confusing empty page.
  if (Number.isNaN(Date.parse(parsed.value))) {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  return { value: parsed.value, id: parsed.id };
}

// Shared by every "my trips" style list: upcoming trips read forwards from
// now (soonest first), past trips read backwards (most recent first). The
// scope decides both the filter and the sort direction, so they can never
// disagree.
export type TripScope = 'upcoming' | 'past';

export function scopeToDirection(scope: TripScope): 'asc' | 'desc' {
  return scope === 'upcoming' ? 'asc' : 'desc';
}
