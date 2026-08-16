import { ArrowLeft, Car, Clock, Route, Snowflake, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getRide } from '@/api/endpoints/rides';
import { useApiQuery } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { Fare, FareBreakdown } from '@/components/domain/Fare';
import { LazyRouteMap, type MapPoint } from '@/components/domain/LazyRouteMap';
import { RatingDisplay } from '@/components/domain/StarRating';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { StatusHint, StatusPill } from '@/components/domain/StatusPill';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { SelectInput } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { parseSearchCriteria } from '@/features/search/searchParams';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { formatDuration } from '@/lib/money';
import { RIDE_STATUS } from '@/lib/statusMaps';

// The backend applies PASSENGER_PREPAYMENT_PERCENT (10) when the booking is
// created. Mirrored here only to preview the split before committing — the
// figure the user is actually charged always comes from the booking response.
const PREPAYMENT_PERCENT = 10;

const VEHICLE_LABELS: Record<string, string> = {
  HATCHBACK: 'Hatchback',
  SEDAN: 'Sedan',
  SUV: 'SUV',
  MUV: 'MUV',
};

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [seatCount, setSeatCount] = useState(1);

  const {
    data: ride,
    error,
    isLoading,
    refetch,
  } = useApiQuery(
    rideId !== undefined ? `rides:${rideId}` : null,
    useCallback((signal: AbortSignal) => getRide(rideId ?? '', signal), [rideId]),
  );

  // Carried through from the search URL, so the map can show where the user
  // actually wants to join and leave the route — not just where the driver
  // starts and ends.
  const criteria = parseSearchCriteria(searchParams);

  const points = useMemo<MapPoint[]>(() => {
    if (ride === undefined) return [];

    const result: MapPoint[] = [
      {
        latitude: ride.origin.latitude,
        longitude: ride.origin.longitude,
        label: ride.origin.address ?? 'Driver starts here',
        kind: 'origin',
      },
      {
        latitude: ride.destination.latitude,
        longitude: ride.destination.longitude,
        label: ride.destination.address ?? 'Driver ends here',
        kind: 'destination',
      },
    ];

    if (criteria !== null) {
      result.push(
        {
          latitude: criteria.from.latitude,
          longitude: criteria.from.longitude,
          label: `Your pickup — ${criteria.from.label}`,
          kind: 'pickup',
        },
        {
          latitude: criteria.to.latitude,
          longitude: criteria.to.longitude,
          label: `Your drop-off — ${criteria.to.label}`,
          kind: 'drop',
        },
      );
    }

    return result;
  }, [ride, criteria]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  if (error !== undefined || ride === undefined) {
    return <ErrorState error={error} onRetry={refetch} className="my-12" />;
  }

  const isOwnRide = ride.driverId === user?.id;
  const bookable = ride.status === 'OPEN' && ride.availableSeats > 0;
  const totalFare = ride.farePerSeat * seatCount;
  const prepaidPreview = Math.round((totalFare * PREPAYMENT_PERCENT) / 100);
  const maxSeats = Math.max(1, ride.availableSeats);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {ride.origin.address ?? 'Pickup'} → {ride.destination.address ?? 'Drop-off'}
          </h1>
          <p className="mt-1 text-ink-muted">
            {formatDeparture(ride.departureTime)}
            <span className="text-ink-faint"> · {formatRelativeToNow(ride.departureTime)}</span>
          </p>
        </div>
        <StatusPill status={ride.status} map={RIDE_STATUS} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <LazyRouteMap geometry={ride.routeGeometry} points={points} />

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Route className="size-4" aria-hidden />
              {(ride.distanceMeters / 1000).toFixed(0)} km
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {formatDuration(ride.durationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {ride.availableSeats} of {ride.totalSeats} seats free
            </span>
          </div>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-700 text-sm font-medium text-white">
                  {ride.driver.name.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-ink">{ride.driver.name}</p>
                  <RatingDisplay rating={ride.driver.rating} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border-subtle pt-4 text-sm text-ink-muted">
                <Car className="size-4" aria-hidden />
                <span className="text-ink">
                  {ride.vehicle.make} {ride.vehicle.model}
                </span>
                <span className="text-ink-faint">
                  · {VEHICLE_LABELS[ride.vehicle.vehicleType] ?? ride.vehicle.vehicleType}
                </span>
                <span className="text-ink-faint">· {ride.vehicle.registrationNumber}</span>
                {ride.vehicle.isAc && (
                  <span className="inline-flex items-center gap-1 text-ink-faint">
                    <Snowflake className="size-3.5" aria-hidden />
                    AC
                  </span>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-20">
          <CardBody className="space-y-4">
            <div className="flex items-baseline justify-between">
              <Fare amount={ride.farePerSeat} size="lg" />
              <span className="text-sm text-ink-muted">per seat</span>
            </div>

            {isOwnRide ? (
              <>
                <p className="text-sm text-ink-muted">This is your ride.</p>
                <Link to={`/rides/${ride.id}/manage`} className="block">
                  <Button className="w-full">Manage this ride</Button>
                </Link>
              </>
            ) : bookable ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Seats</span>
                  <SelectInput
                    value={seatCount}
                    onChange={(event) => {
                      setSeatCount(Number(event.target.value));
                    }}
                  >
                    {Array.from({ length: maxSeats }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? 'seat' : 'seats'}
                      </option>
                    ))}
                  </SelectInput>
                </label>

                <div className="border-t border-border-subtle pt-4">
                  <FareBreakdown
                    farePerSeat={ride.farePerSeat}
                    seatCount={seatCount}
                    totalFare={totalFare}
                    prepaidAmount={prepaidPreview}
                  />
                </div>

                <Link to={`/rides/${ride.id}/book?seats=${String(seatCount)}`} className="block">
                  <Button size="lg" className="w-full">
                    Book {seatCount} {seatCount === 1 ? 'seat' : 'seats'}
                  </Button>
                </Link>

                <p className="text-xs text-ink-faint">
                  You pay <Fare amount={prepaidPreview} size="sm" /> now to reserve. The rest is due
                  after the trip.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <StatusHint status={ride.status} map={RIDE_STATUS} />
                <EmptyState
                  title={
                    ride.availableSeats === 0 ? 'This ride is full' : 'This ride is not bookable'
                  }
                  description="Try another ride on the same route."
                  className="border-0 px-0 py-4"
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
