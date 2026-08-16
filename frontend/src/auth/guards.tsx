import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { EmptyState } from '@/components/domain/States';
import { useAuth } from '@/auth/AuthProvider';
import type { UserRole } from '@/api/types';

function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="size-6 animate-spin rounded-full border-2 border-border-strong border-t-accent-700" />
    </div>
  );
}

// Gates a route on being signed in. The attempted location is passed along so
// login can return the user to it — which is what makes the landing page's
// "search, then sign in, then see results" flow work.
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children ?? <Outlet />}</>;
}

// Gates on role. Renders an explanation rather than redirecting: a passenger
// who lands on /offer needs to be told there is a verification process, not
// silently bounced somewhere else.
export function RequireRole({
  role,
  fallback,
  children,
}: {
  role: UserRole;
  fallback?: ReactNode;
  children?: ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;

  if (user?.role !== role) {
    return (
      <>
        {fallback ?? (
          <EmptyState
            title="You do not have access to this page"
            description="If you think this is a mistake, check that you are signed in with the right account."
          />
        )}
      </>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
