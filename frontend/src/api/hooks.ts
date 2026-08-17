import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from './client';
import { dedupe, invalidate, readCache, subscribe, writeCache } from './store';

const DEFAULT_STALE_MS = 30_000;

export interface QueryOptions {
  // `null` key disables the query — used for dependent fetches ("load the
  // ride only once we know its id").
  staleTime?: number;
  // Drives the payment-confirmation poll. The backend's webhook is the only
  // authority on payment state, so the client's only honest option is to ask
  // repeatedly until the status changes.
  refetchInterval?: number | false;
  // Refetch when the tab regains focus. Off by default to stay inside the
  // backend's read rate limits, but notifications need it: they arrive by FCM
  // push and are never delivered over the socket, so returning to the tab is
  // the only moment a web client can discover new ones.
  refetchOnWindowFocus?: boolean;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  // No data yet — render a skeleton.
  isLoading: boolean;
  // A request is open, but stale data is already on screen — render it and
  // show a quiet activity hint instead of tearing the page down.
  isFetching: boolean;
  refetch: () => void;
}

export function useApiQuery<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const {
    staleTime = DEFAULT_STALE_MS,
    refetchInterval = false,
    refetchOnWindowFocus = false,
  } = options;

  const cached = key !== null ? readCache<T>(key) : undefined;
  const [data, setData] = useState<T | undefined>(cached?.data);
  const [error, setError] = useState<unknown>(undefined);
  const [isFetching, setIsFetching] = useState(false);

  // Callers pass inline arrow functions, which change identity every render.
  // Holding the latest in a ref keeps the fetch effect keyed on `key` alone,
  // instead of re-running on every parent render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (activeKey: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsFetching(true);
      try {
        const result = await dedupe(activeKey, (signal) => fetcherRef.current(signal));
        if (controller.signal.aborted) return;
        writeCache(activeKey, result);
        setData(result);
        setError(undefined);
      } catch (caught) {
        // This component moved on — its own signal is the only reason to stay
        // silent about a failure.
        if (controller.signal.aborted) return;
        // Everything else must reach state. There is deliberately no blanket
        // AbortError guard here: swallowing one while this caller is still
        // alive sets neither `data` nor `error`, which reads as "loading
        // forever" and is exactly the bug that used to strand the admin
        // queues on skeletons.
        setError(caught);
      } finally {
        if (!controller.signal.aborted) setIsFetching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (key === null) {
      setData(undefined);
      return;
    }

    const entry = readCache<T>(key);
    setData(entry?.data);
    setError(undefined);

    const isFresh = entry !== undefined && Date.now() - entry.updatedAt < staleTime;
    if (!isFresh) void run(key);

    // Refetch when a mutation invalidates this key.
    const unsubscribe = subscribe(key, () => {
      void run(key);
    });

    return () => {
      unsubscribe();
      abortRef.current?.abort();
    };
  }, [key, staleTime, run]);

  useEffect(() => {
    if (key === null || refetchInterval === false) return;

    const timer = window.setInterval(() => {
      void run(key);
    }, refetchInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [key, refetchInterval, run]);

  useEffect(() => {
    if (key === null || !refetchOnWindowFocus) return;

    const onFocus = () => {
      if (document.visibilityState === 'visible') void run(key);
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [key, refetchOnWindowFocus, run]);

  const refetch = useCallback(() => {
    if (key !== null) void run(key);
  }, [key, run]);

  return {
    data,
    error,
    isLoading: data === undefined && error === undefined && key !== null,
    isFetching,
    refetch,
  };
}

export interface MutationOptions<TVars, TData> {
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: unknown, vars: TVars) => void;
  // Cache prefixes to invalidate on success — the mechanism that keeps a
  // trip list correct after a booking is cancelled from its detail page.
  invalidates?: string[];
}

export interface MutationResult<TVars, TData> {
  mutate: (vars: TVars) => void;
  mutateAsync: (vars: TVars) => Promise<TData>;
  isPending: boolean;
  error: unknown;
  data: TData | undefined;
  reset: () => void;
}

export function useApiMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: MutationOptions<TVars, TData> = {},
): MutationResult<TVars, TData> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [data, setData] = useState<TData | undefined>(undefined);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const fnRef = useRef(mutationFn);
  fnRef.current = mutationFn;

  const mutateAsync = useCallback(async (vars: TVars): Promise<TData> => {
    setIsPending(true);
    setError(undefined);
    try {
      const result = await fnRef.current(vars);
      if (mountedRef.current) {
        setData(result);
      }
      const { invalidates, onSuccess } = optionsRef.current;
      if (invalidates !== undefined && invalidates.length > 0) invalidate(...invalidates);
      onSuccess?.(result, vars);
      return result;
    } catch (caught) {
      if (mountedRef.current) setError(caught);
      optionsRef.current.onError?.(caught, vars);
      throw caught;
    } finally {
      if (mountedRef.current) setIsPending(false);
    }
  }, []);

  // Fire-and-forget variant. Rejections are already delivered through
  // `onError` and `error`, so the promise is deliberately swallowed here to
  // avoid an unhandled rejection for callers that do not await.
  const mutate = useCallback(
    (vars: TVars) => {
      void mutateAsync(vars).catch(() => undefined);
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setError(undefined);
    setData(undefined);
    setIsPending(false);
  }, []);

  return { mutate, mutateAsync, isPending, error, data, reset };
}

// Cursor pagination for the list endpoints, which all return
// { items, nextCursor }. Accumulates pages rather than replacing them, so
// "Load more" appends the way the UI expects.
export interface PaginatedResult<T> {
  items: T[];
  error: unknown;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

export function usePaginatedQuery<T>(
  key: string | null,
  fetchPage: (cursor: string | undefined, signal: AbortSignal) => Promise<{
    items: T[];
    nextCursor: string | null;
  }>,
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(key !== null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (nextCursor: string | undefined, append: boolean) => {
    const controller = new AbortController();
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const page = await fetchRef.current(nextCursor, controller.signal);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError(undefined);
    } catch (caught) {
      // A stale cursor (INVALID_CURSOR) means the list moved underneath us;
      // the only sane recovery is to drop what we have and start again.
      if (caught instanceof ApiError && caught.code === 'INVALID_CURSOR') {
        setItems([]);
        setCursor(null);
      }
      setError(caught);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (key === null) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setItems([]);
    setCursor(null);
    void load(undefined, false);

    const unsubscribe = subscribe(key, () => {
      void load(undefined, false);
    });
    return unsubscribe;
  }, [key, load]);

  return {
    items,
    error,
    isLoading,
    isLoadingMore,
    hasMore: cursor !== null,
    loadMore: () => {
      if (cursor !== null && !isLoadingMore) void load(cursor, true);
    },
    reload: () => {
      void load(undefined, false);
    },
  };
}
