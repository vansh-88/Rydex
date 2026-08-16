import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, forceTokenRefresh } from '@/api/client';
import * as authApi from '@/api/endpoints/auth';
import { clearCache } from '@/api/store';
import type { AuthTokens, UserProfile } from '@/api/types';
import { tokenStore } from '@/auth/tokenStore';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  isDriver: boolean;
  isAdmin: boolean;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: (allDevices?: boolean) => Promise<void>;
  // Called after actions that change the profile — a verified driver
  // application flips `role`, which changes what the nav shows.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // The access token lives in memory only, so after a reload there is a
  // refresh token but no session yet — start in `loading` and let the restore
  // effect decide, rather than flashing signed-out UI.
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStore.getRefreshToken() !== null ? 'loading' : 'anonymous',
  );
  const [user, setUser] = useState<UserProfile | null>(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    // A previous user's cached trips must never be visible to whoever signs
    // in next on this device.
    clearCache();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // The API client discovers a dead refresh token mid-request, far from any
  // React tree, so it announces the logout and this listener reacts.
  useEffect(() => tokenStore.onForcedLogout(clearSession), [clearSession]);

  // The profile is read live from the database; the access token's `role`
  // claim is a snapshot from when it was minted. When an admin approves a
  // driver application those two disagree, and the stale claim is what the
  // backend's authorize() actually enforces — so the user would be told they
  // are a driver and then rejected from every driver action until the token
  // expired. Refreshing mints a token carrying the new role immediately.
  const reconcileRoleClaim = useCallback(async (profile: UserProfile) => {
    const claimedRole = tokenStore.getAccessTokenRole();
    if (claimedRole !== null && claimedRole !== profile.role) {
      await forceTokenRefresh().catch(() => undefined);
    }
  }, []);

  // Restore the session on load. apiRequest transparently exchanges the
  // stored refresh token for a fresh access token before this call lands.
  useEffect(() => {
    if (tokenStore.getRefreshToken() === null) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const profile = await authApi.getMe(controller.signal);
        if (controller.signal.aborted) return;
        setUser(profile);
        setStatus('authenticated');
        await reconcileRoleClaim(profile);
      } catch (error) {
        if (controller.signal.aborted) return;
        // A 401 here means the refresh token was expired or revoked, and
        // tokenStore has already emitted a forced logout. Anything else (the
        // server being down) should not destroy a session that may still be
        // valid — leave the tokens alone and let the user retry.
        if (error instanceof ApiError && error.status === 401) return;
        setStatus('anonymous');
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  const signIn = useCallback(async (tokens: AuthTokens) => {
    tokenStore.setTokens(tokens);
    // verify-otp returns a slim user object; the full profile carries ratings
    // and driver-licence state that the shell needs.
    try {
      setUser(await authApi.getMe());
    } catch {
      // Falling back to the slim object keeps sign-in working even if the
      // profile fetch fails; the shell degrades rather than blocking entry.
      setUser(null);
    }
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(
    async (allDevices = false) => {
      const refreshToken = tokenStore.getRefreshToken();
      if (refreshToken !== null) {
        // Best-effort: the local session is dropped regardless, since a user
        // who clicked "sign out" must end up signed out even offline.
        await authApi.logout(refreshToken, allDevices).catch(() => undefined);
      }
      clearSession();
    },
    [clearSession],
  );

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      await reconcileRoleClaim(profile);
    } catch {
      /* keep the existing profile — a failed refresh is not a logout */
    }
  }, [reconcileRoleClaim]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isDriver: user?.role === 'DRIVER',
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signOut,
      refreshUser,
    }),
    [status, user, signIn, signOut, refreshUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
