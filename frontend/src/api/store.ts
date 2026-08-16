// A deliberately small cache behind useApiQuery.
//
// It exists for three specific jobs the app actually needs, not to be a
// general data layer: serve a cached list instantly when a user navigates
// back to it, let a mutation tell related screens to refetch, and stop two
// components mounting at once from firing the same request twice.
//
// Keys are plain strings that mirror the endpoint they cache
// ("bookings:upcoming", "rides/mine:past"), because invalidation works by
// prefix — invalidate("bookings") refreshes every booking list on screen.
interface CacheEntry {
  data: unknown;
  updatedAt: number;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();
// Requests currently in flight, so simultaneous mounts of the same key share
// one network call rather than racing.
const inFlight = new Map<string, Promise<unknown>>();

export function readCache<T>(key: string): { data: T; updatedAt: number } | undefined {
  const entry = cache.get(key);
  if (entry === undefined) return undefined;
  return { data: entry.data as T, updatedAt: entry.updatedAt };
}

export function writeCache(key: string, data: unknown): void {
  cache.set(key, { data, updatedAt: Date.now() });
}

export function dropCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) cache.delete(key);
  }
}

export function subscribe(key: string, onInvalidate: () => void): () => void {
  const existing = listeners.get(key) ?? new Set<() => void>();
  existing.add(onInvalidate);
  listeners.set(key, existing);

  return () => {
    existing.delete(onInvalidate);
    if (existing.size === 0) listeners.delete(key);
  };
}

// Drops matching cache entries and asks every mounted query under the prefix
// to refetch. Called after a mutation: booking a seat invalidates both the
// ride (its seat count changed) and the caller's trip list.
export function invalidate(...prefixes: string[]): void {
  for (const prefix of prefixes) {
    dropCache(prefix);
    for (const [key, keyListeners] of listeners) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        keyListeners.forEach((listener) => {
          listener();
        });
      }
    }
  }
}

// Shares one promise per key across concurrent callers.
export async function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing !== undefined) return existing as Promise<T>;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

// Called on logout — one user's cached trips must never be visible to the
// next person who signs in on the same device.
export function clearCache(): void {
  cache.clear();
  inFlight.clear();
}
