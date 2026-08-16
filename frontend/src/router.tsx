import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth, RequireRole } from '@/auth/guards';
import { AppShell } from '@/components/layout/AppShell';
import { Home } from '@/routes/Home';
import { KitchenSink } from '@/routes/KitchenSink';
import { Login } from '@/routes/Login';
import { NotFound } from '@/routes/NotFound';
import { AdminLayout } from '@/routes/admin/AdminLayout';
import { AdminVehicles } from '@/routes/admin/AdminVehicles';
import { DriverApplications } from '@/routes/admin/DriverApplications';
import { BecomeDriver } from '@/routes/BecomeDriver';
import { BookRide } from '@/routes/BookRide';
import { MyTrips } from '@/routes/MyTrips';
import { Placeholder } from '@/routes/Placeholder';
import { Profile } from '@/routes/Profile';
import { RideDetail } from '@/routes/RideDetail';
import { SearchResults } from '@/routes/SearchResults';
import { TripDetail } from '@/routes/TripDetail';
import { VehicleDetail } from '@/routes/VehicleDetail';
import { Vehicles } from '@/routes/Vehicles';

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
              { path: 'trips', element: <MyTrips /> },
              { path: 'trips/:bookingId', element: <TripDetail /> },
              { path: 'offer', element: <Placeholder title="Offer a ride" phase="Phase 7" /> },
              {
                path: 'rides/:rideId/manage',
                element: <Placeholder title="Manage ride" phase="Phase 8" />,
              },
              { path: 'become-a-driver', element: <BecomeDriver /> },
              { path: 'vehicles', element: <Vehicles /> },
              { path: 'vehicles/:vehicleId', element: <VehicleDetail /> },
              { path: 'messages', element: <Placeholder title="Messages" phase="Phase 9" /> },
              {
                path: 'notifications',
                element: <Placeholder title="Notifications" phase="Phase 10" />,
              },
              { path: 'help', element: <Placeholder title="Support" phase="Phase 10" /> },
              { path: 'profile', element: <Profile /> },

              {
                path: 'admin',
                element: <RequireRole role="ADMIN" />,
                children: [
                  {
                    element: <AdminLayout />,
                    children: [
                      { index: true, element: <Navigate to="/admin/driver-applications" replace /> },
                      { path: 'driver-applications', element: <DriverApplications /> },
                      { path: 'vehicles', element: <AdminVehicles /> },
                    ],
                  },
                ],
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
