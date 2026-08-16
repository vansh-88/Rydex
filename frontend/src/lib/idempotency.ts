// The backend requires an Idempotency-Key on POST /rides and
// POST /rides/:id/bookings, and replays the original response for a repeated
// key. That only protects the user if the key is stable across retries of the
// *same intent* — a fresh key on a retry is a second charge, which is exactly
// the failure the header exists to prevent.
//
// Keys are persisted rather than held in memory so that a reload mid-payment
// (or a crashed tab) resumes the same operation instead of starting a new one.
const STORAGE_PREFIX = 'rydex.idem.';
// Matches IDEMPOTENCY_KEY_TTL_HOURS (24) on the backend; a key the server has
// forgotten is worth nothing, so there is no reason to keep it longer.
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredKey {
  key: string;
  createdAt: number;
}

// `intent` identifies what the user is trying to do, not when they clicked:
// "book:<rideId>:<seatCount>" is the same intent however many times it is
// retried, but changing the seat count is genuinely a different request and
// the backend would reject the reused key with IDEMPOTENCY_CONFLICT.
export function idempotencyKeyFor(intent: string): string {
  const storageKey = `${STORAGE_PREFIX}${intent}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      const stored = JSON.parse(raw) as StoredKey;
      if (Date.now() - stored.createdAt < TTL_MS) return stored.key;
    }
  } catch {
    // Unparseable or unavailable storage falls through to a fresh key.
  }

  const key = crypto.randomUUID();
  try {
    localStorage.setItem(storageKey, JSON.stringify({ key, createdAt: Date.now() } as StoredKey));
  } catch {
    /* private mode — the key still works for this attempt */
  }
  return key;
}

// Called once an operation has definitively finished, so a later, genuinely
// new attempt (booking the same ride again after cancelling) is not replayed
// as the old one.
export function clearIdempotencyKey(intent: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${intent}`);
  } catch {
    /* nothing to clean up */
  }
}
