// Token storage.
//
// The access token lives in memory only: it is short-lived (15 minutes, hard
// coded in the backend's tokenService) and keeping it out of storage means a
// stray XSS payload cannot read it from disk after the tab closes.
//
// The refresh token has to survive a reload, and localStorage is the only
// option available — the backend issues tokens in the response body with
// `credentials: false` and sets no cookies, so there is no httpOnly path to
// use instead. The mitigations that matter are on the backend and already
// exist: refresh tokens rotate on every use, and replaying a rotated one
// revokes the entire token family (REFRESH_TOKEN_REUSE_DETECTED).
const REFRESH_STORAGE_KEY = 'rydex.refreshToken';

let accessToken: string | null = null;
const logoutListeners = new Set<() => void>();

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_STORAGE_KEY);
    } catch {
      // Safari in private mode, or storage disabled entirely. The session
      // still works until the access token expires; it just cannot survive
      // a reload.
      return null;
    }
  },

  setTokens(tokens: { accessToken: string; refreshToken: string }): void {
    accessToken = tokens.accessToken;
    try {
      localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
    } catch {
      /* see getRefreshToken */
    }
  },

  clear(): void {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_STORAGE_KEY);
    } catch {
      /* see getRefreshToken */
    }
  },

  // The `role` claim baked into the current access token.
  //
  // This matters because the claim is a snapshot from when the token was
  // minted, while the profile is read live from the database. An admin
  // approving a driver application flips the role server-side, but the
  // applicant's existing token keeps saying PASSENGER for up to its 15-minute
  // lifetime — so `authorize('DRIVER')` would reject them from the very
  // actions the app has just told them they can take. AuthProvider compares
  // the two and forces a refresh when they disagree.
  //
  // Decoding is for display/comparison only. The token is signed and the
  // backend verifies it; nothing here is trusted for access control.
  getAccessTokenRole(): string | null {
    if (accessToken === null) return null;
    try {
      const payload = accessToken.split('.')[1];
      if (payload === undefined) return null;
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(json) as { role?: unknown };
      return typeof claims.role === 'string' ? claims.role : null;
    } catch {
      return null;
    }
  },

  // Lets AuthProvider react to a logout the API client decided on its own —
  // an expired or revoked refresh token is discovered mid-request, far from
  // any React tree.
  onForcedLogout(listener: () => void): () => void {
    logoutListeners.add(listener);
    return () => logoutListeners.delete(listener);
  },

  emitForcedLogout(): void {
    this.clear();
    logoutListeners.forEach((listener) => {
      listener();
    });
  },
};
