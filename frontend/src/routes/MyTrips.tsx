import { CarFront, Search } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listMyBookings } from '@/api/endpoints/bookings';
import { listMyRides } from '@/api/endpoints/rides';
import { usePaginatedQuery } from '@/api/hooks';
import type { TripScope } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { Button, buttonStyles } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SegmentedControl, TabPanel, Tabs } from '@/components/ui/Tabs';
import { BookingTripCard, DriverRideCard } from '@/features/trips/TripCards';

type TripRole = 'riding' | 'driving';

// One page for everything the user has going on. The Riding/Driving switch is
// rendered only for drivers — a passenger has no rides by construction, and a
// toggle with one meaningful side is just clutter.
export function MyTrips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDriver } = useAuth();

  const roleParam = searchParams.get('role');
  const role: TripRole = isDriver && roleParam === 'driving' ? 'driving' : 'riding';
  const scope: TripScope = searchParams.get('scope') === 'past' ? 'past' : 'upcoming';

  function update(next: { role?: TripRole; scope?: TripScope }) {
    const params = new URLSearchParams(searchParams);
    if (next.role !== undefined) params.set('role', next.role);
    if (next.scope !== undefined) params.set('scope', next.scope);
    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">My trips</h1>
        {isDriver && (
          <SegmentedControl<TripRole>
            aria-label="Show trips where I am"
            value={role}
            onValueChange={(next) => {
              update({ role: next });
            }}
            options={[
              { value: 'riding', label: 'Riding' },
              { value: 'driving', label: 'Driving' },
            ]}
          />
        )}
      </div>

      <Tabs
        value={scope}
        onValueChange={(next) => {
          update({ scope: next as TripScope });
        }}
        items={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past' },
        ]}
      >
        <TabPanel value={scope} className="pt-5">
          {role === 'riding' ? <RidingList scope={scope} /> : <DrivingList scope={scope} />}
        </TabPanel>
      </Tabs>
    </div>
  );
}

function RidingList({ scope }: { scope: TripScope }) {
  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => listMyBookings(scope, cursor, signal),
    [scope],
  );

  const { items, error, isLoading, isLoadingMore, hasMore, loadMore, reload } = usePaginatedQuery(
    `bookings:${scope}`,
    fetchPage,
  );

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined && items.length === 0) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={scope === 'upcoming' ? Search : CarFront}
        title={scope === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
        description={
          scope === 'upcoming'
            ? 'Book a seat and it will show up here.'
            : 'Trips you have completed will appear here.'
        }
        action={
          scope === 'upcoming' ? (
            <Link to="/" className={buttonStyles()}>
              Find a ride
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((booking) => (
        <BookingTripCard key={booking.id} booking={booking} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" loading={isLoadingMore} onClick={loadMore}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}

function DrivingList({ scope }: { scope: TripScope }) {
  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => listMyRides(scope, cursor, signal),
    [scope],
  );

  const { items, error, isLoading, isLoadingMore, hasMore, loadMore, reload } = usePaginatedQuery(
    `rides/mine:${scope}`,
    fetchPage,
  );

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined && items.length === 0) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CarFront}
        title={scope === 'upcoming' ? 'No rides published' : 'No past rides'}
        description={
          scope === 'upcoming'
            ? 'Publish a ride you are already making and sell the empty seats.'
            : 'Rides you have completed will appear here.'
        }
        action={
          scope === 'upcoming' ? (
            <Link to="/offer" className={buttonStyles()}>
              Offer a ride
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((ride) => (
        <DriverRideCard key={ride.id} ride={ride} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" loading={isLoadingMore} onClick={loadMore}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
