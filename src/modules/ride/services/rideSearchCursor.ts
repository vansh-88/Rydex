import { AppError } from '../../../shared/errors/AppError.js';
import type { RideSortOption } from '../schemas/rideSearchSchemas.js';

export interface RideSearchCursor {
  sort: RideSortOption;
  // Stringified value of whichever field the list is sorted on (ISO
  // timestamp for DEPARTURE_TIME, numeric string otherwise), plus the row's
  // id as the deterministic tie-breaker (claude.md §25/§26).
  value: string;
  id: string;
}

function isCursorShape(value: unknown): value is { sort: unknown; value: unknown; id: unknown } {
  return typeof value === 'object' && value !== null && 'sort' in value && 'value' in value && 'id' in value;
}

// claude.md §26: "the cursor must be opaque to the client" and must not
// expose raw SQL/internal query state — this is base64(JSON), not a query
// fragment.
export function encodeRideSearchCursor(cursor: RideSearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeRideSearchCursor(raw: string, expectedSort: RideSortOption): RideSearchCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  if (
    !isCursorShape(parsed) ||
    typeof parsed.sort !== 'string' ||
    typeof parsed.value !== 'string' ||
    typeof parsed.id !== 'string'
  ) {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is malformed');
  }

  // A cursor minted for one sort order doesn't compose with a different one
  // (the keyset comparison depends on the exact sorted field) — reject
  // rather than silently produce wrong pagination.
  if (parsed.sort !== expectedSort) {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor does not match the requested sort order');
  }

  return { sort: expectedSort, value: parsed.value, id: parsed.id };
}
