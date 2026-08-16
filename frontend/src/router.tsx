import { createBrowserRouter, Outlet } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth, RequireRole } from '@/auth/guards';
import { AppShell } from '@/components/layout/AppShell';
import { Home } from '@/routes/Home';
import { KitchenSink } from '@/routes/KitchenSink';
import { Login } from '@/routes/Login';
import { NotFound } from '@/routes/NotFound';
import { BookRide } from '@/routes/BookRide';
import { Placeholder } from '@/routes/Placeholder';
import { RideDetail } from '@/routes/RideDetail';
import { SearchResults } from '@/routes/SearchResults';

// One AuthProvider above everything, so login and the shell share a session
// and a sign-in immediately updates the nav without a reload.
function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthRoot />,
    children: [
      // Login sits outside the shell — it has its own centred layout and no nav.
      { path: 'login', element: <Login /> },

      {
        element: <AppShell />,
        children: [
          // Public. The landing page shows the search form to anyone;
          // submitting it routes an anonymous visitor through login and then
          // runs the search, since GET /rides/search requires auth.
          { index: true, element: <Home /> },

          {
            element: <RequireAuth />,
            children: [
              { path: 'search', element: <SearchResults /> },
              { path: 'rides/:rideId', element: <RideDetail /> },
              { path: 'rides/:rideId/book', element: <BookRide /> },
              { path: 'trips', element: <Placeholder title="My trips" phase="Phase 5" /> },
              {
                path: 'trips/:bookingId',
                element: <Placeholder title="Trip detail" phase="Phase 5" />,
              },
              { path: 'offer', element: <Placeholder title="Offer a ride" phase="Phase 7" /> },
              {
                path: 'rides/:rideId/manage',
                element: <Placeholder title="Manage ride" phase="Phase 8" />,
              },
              {
                path: 'become-a-driver',
                element: <Placeholder title="Become a driver" phase="Phase 6" />,
              },
              { path: 'vehicles', element: <Placeholder title="My vehicles" phase="Phase 6" /> },
              { path: 'messages', element: <Placeholder title="Messages" phase="Phase 9" /> },
              {
                path: 'notifications',
                element: <Placeholder title="Notifications" phase="Phase 10" />,
              },
              { path: 'help', element: <Placeholder title="Support" phase="Phase 10" /> },
              { path: 'profile', element: <Placeholder title="Profile" phase="Phase 6" /> },

              {
                path: 'admin',
                element: <RequireRole role="ADMIN" />,
                children: [{ index: true, element: <Placeholder title="Admin" phase="Phase 6" /> }],
              },
            ],
          },

          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },

  // Development-only design-system preview, deliberately outside the shell.
  { path: '/_kitchen-sink', element: <KitchenSink /> },
]);
