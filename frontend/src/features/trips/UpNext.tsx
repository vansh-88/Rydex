import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { listMyBookings } from '@/api/endpoints/bookings';
import { useApiQuery } from '@/api/hooks';
import { Countdown } from '@/components/domain/Countdown';
import { StatusPill } from '@/components/domain/StatusPill';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { BOOKING_STATUS } from '@/lib/statusMaps';

// The signed-in half of the landing page: the next trip, and anything the
// user still owes an action on. Deliberately not a dashboard — it renders
// nothing at all when there is nothing to do, rather than filling the page
// with empty widgets.
export function UpNext() {
  const { data, isLoading } = useApiQuery(
    'bookings:upcoming',
    useCallback((signal: AbortSignal) => listMyBookings('upcoming', undefined, signal), []),
  );

  if (isLoading || data === undefined || data.items.length === 0) return null;

  // An unpaid booking is on a 15-minute fuse, so it outranks a trip that is
  // merely sooner.
  const unpaid = data.items.filter((booking) => booking.status === 'PENDING_PAYMENT');
  const next = data.items.find((booking) => booking.status === 'CONFIRMED');

  if (unpaid.length === 0 && next === undefined) return null;

  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-sm font-medium text-ink-muted">
        {unpaid.length > 0 ? 'Needs your attention' : 'Up next'}
      </h2>

      {unpaid.map((booking) => (
        <Card key={booking.id} className="border-amber-200 bg-amber-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {booking.ride.originAddress ?? 'Pickup'}{' '}
                <span className="text-ink-faint">→</span>{' '}
                {booking.ride.destinationAddress ?? 'Drop-off'}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                Your seat is held — <Countdown createdAt={booking.createdAt} />
              </p>
            </div>
            <Link
              to={`/rides/${booking.rideId}/book?seats=${String(booking.seatCount)}`}
              className={buttonStyles({ size: 'sm' })}
            >
              Complete payment
            </Link>
          </div>
        </Card>
      ))}

      {next !== undefined && unpaid.length === 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">
                  {next.ride.originAddress ?? 'Pickup'} <span className="text-ink-faint">→</span>{' '}
                  {next.ride.destinationAddress ?? 'Drop-off'}
                </p>
                <StatusPill status={next.status} map={BOOKING_STATUS} />
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">
                {formatDeparture(next.ride.departureTime)}
                <span className="text-ink-faint">
                  {' '}
                  · {formatRelativeToNow(next.ride.departureTime)}
                </span>
              </p>
            </div>
            <Link
              to={`/trips/${next.id}`}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              View trip
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}
