import { Snowflake, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { RideSearchResult } from '@/api/types';
import { RatingDisplay } from '@/components/domain/StarRating';
import { Fare } from '@/components/domain/Fare';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDay, formatTime } from '@/lib/kolkataDate';
import { formatDistanceKm } from '@/lib/money';

const VEHICLE_LABELS: Record<string, string> = {
  HATCHBACK: 'Hatchback',
  SEDAN: 'Sedan',
  SUV: 'SUV',
  MUV: 'MUV',
};

// Search results carry no addresses — only how far each ride's endpoints are
// from the two points the user asked about. So a row can never name a place;
// it answers "how far out of my way is this?" instead, which is the actual
// question when the match radius is 10 km.
export function RideResultCard({ ride }: { ride: RideSearchResult }) {
  return (
    <Card className="transition-colors hover:border-border-strong">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="shrink-0 sm:w-28">
          <p className="text-lg font-semibold text-ink">{formatTime(ride.departureTime)}</p>
          <p className="text-sm text-ink-muted">{formatDay(ride.departureTime)}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{ride.driver.name}</span>
            <RatingDisplay rating={ride.driver.rating} />
          </div>

          <p className="text-sm text-ink-muted">
            {ride.vehicle.model}
            <span className="text-ink-faint"> · {VEHICLE_LABELS[ride.vehicle.type] ?? ride.vehicle.type}</span>
            {ride.vehicle.ac && (
              <span className="ml-2 inline-flex items-center gap-1 text-ink-faint">
                <Snowflake className="size-3.5" aria-hidden />
                AC
              </span>
            )}
          </p>

          <p className="text-sm text-ink-muted">
            {formatDistanceKm(ride.pickupDistanceKm)} from your pickup ·{' '}
            {formatDistanceKm(ride.destinationDistanceKm)} from your drop-off
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
          <div className="sm:text-right">
            <Fare amount={ride.farePerSeat} size="lg" />
            <p className="text-xs text-ink-muted">per seat</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
              <Users className="size-3.5" aria-hidden />
              {ride.availableSeats} {ride.availableSeats === 1 ? 'seat' : 'seats'} left
            </p>
          </div>

          <Link
            to={`/rides/${ride.id}`}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            View ride
          </Link>
        </div>
      </div>
    </Card>
  );
}
