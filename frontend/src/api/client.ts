import { tokenStore } from '@/auth/tokenStore';
import { errorCopy } from '@/lib/errorCopy';

// Every request goes through the Vite dev proxy (or the same origin in a
// build), so the API is always same-origin and CORS never applies.
const API_BASE = '/api/v1';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
  requestId?: string;
}

// Carries the backend's own error code so callers can branch on it
// (SIGNUP_DETAILS_REQUIRED drives the login form's second step;
// NO_SEATS_AVAILABLE means re-search rather than retry) and the requestId so
// a user-reported problem can be found in the server logs.
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  // The backend's raw message. VALIDATION_ERROR puts the offending field
  // path here ("pickupLat: expected number"), which is worth showing next to
  // a form field even though `message` is the copy meant for a toast.
  readonly detail: string;

  constructor(status: number, code: string, detail: string, requestId?: string) {
    super(errorCopy(code, status));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  // Mandatory on POST /rides and POST /rides/:id/bookings. Must be stable
  // across retries of the same user intent — a fresh key on retry charges
  // twice.
  idempotencyKey?: string;
  signal?: AbortSignal;
  // Multipart uploads (driver licence, vehicle documents) set their own
  // Content-Type boundary, so `body` is passed through untouched.
  formData?: FormData;
}

// --- refresh coordination --------------------------------------------
//
// A page typically fires several requests at once, so an expired access token
// produces a burst of simultaneous 401s. Without coordination each one would
// start its own refresh, and because the backend rotates refresh tokens on
// every use, the second rotation would invalidate the first — tripping
// REFRESH_TOKEN_REUSE_DETECTED and logging the user out for doing nothing
// wrong. So exactly one refresh runs and the rest await it.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefreshToken();
  if (refreshToken === null) {
    tokenStore.emitForcedLogout();
    throw new ApiError(401, 'UNAUTHORIZED', 'No refresh token available');
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = (await response.json().catch(() => null)) as
    | SuccessEnvelope<{ accessToken: string; refreshToken: string }>
    | ErrorEnvelope
    | null;

  if (!response.ok || payload === null || payload.success === false) {
    // An expired, revoked or replayed refresh token are all unrecoverable:
    // the only correct response is to send the user back to sign-in.
    tokenStore.emitForcedLogout();
    const error = payload !== null && payload.success === false ? payload.error : undefined;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNAUTHORIZED',
      error?.message ?? 'Session expired',
    );
  }

  tokenStore.setTokens(payload.data);
  return payload.data.accessToken;
}

function ensureFreshToken(): Promise<string> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// --- request ----------------------------------------------------------

async function send<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  const headers: Record<string, string> = {};

  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let body: BodyInit | undefined;
  if (options.formData !== undefined) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | SuccessEnvelope<T>
    | ErrorEnvelope
    | null;

  if (payload === null) {
    throw new ApiError(response.status, 'INTERNAL_ERROR', 'Response was not valid JSON');
  }

  if (payload.success === false) {
    throw new ApiError(response.status, payload.error.code, payload.error.message, payload.requestId);
  }

  return payload.data;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStore.getAccessToken();

  // No access token but a refresh token exists — the usual state right after
  // a page reload, since the access token only ever lived in memory.
  if (token === null && tokenStore.getRefreshToken() !== null) {
    return send<T>(path, options, await ensureFreshToken());
  }

  try {
    return await send<T>(path, options, token);
  } catch (error) {
    const isExpiredAccessToken =
      error instanceof ApiError && error.status === 401 && tokenStore.getRefreshToken() !== null;

    if (!isExpiredAccessToken) throw error;

    // Retried exactly once. If the replay also 401s, refreshAccessToken has
    // already forced a logout and there is nothing left to try.
    return send<T>(path, options, await ensureFreshToken());
  }
}

// Query-string helper that drops undefined values, so callers can pass
// optional filters straight through without assembling params by hand.
export function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}
