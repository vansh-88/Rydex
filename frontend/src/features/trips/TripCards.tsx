import { Car, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { BookingWithRide, RideListItem } from '@/api/types';
import { Countdown } from '@/components/domain/Countdown';
import { Fare } from '@/components/domain/Fare';
import { RatingDisplay } from '@/components/domain/StarRating';
import { StatusPill } from '@/components/domain/StatusPill';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { BOOKING_STATUS, RIDE_STATUS } from '@/lib/statusMaps';

function Route({ from, to }: { from: string | null; to: string | null }) {
  return (
    <p className="font-medium text-ink">
      {from ?? 'Pickup'} <span className="text-ink-faint">→</span> {to ?? 'Drop-off'}
    </p>
  );
}

// The passenger's view of a trip they booked.
export function BookingTripCard({ booking }: { booking: BookingWithRide }) {
  const awaitingPayment = booking.status === 'PENDING_PAYMENT';

  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">
              {formatDeparture(booking.ride.departureTime)}
              <span className="text-ink-faint">
                {' '}
                · {formatRelativeToNow(booking.ride.departureTime)}
              </span>
            </p>
            <div className="mt-1">
              <Route from={booking.ride.originAddress} to={booking.ride.destinationAddress} />
            </div>
          </div>
          <StatusPill status={booking.status} map={BOOKING_STATUS} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="text-ink">{booking.ride.driver.name}</span>
          <RatingDisplay rating={booking.ride.driver.rating} />
          <span className="text-ink-faint">
            · {booking.seatCount} {booking.seatCount === 1 ? 'seat' : 'seats'}
          </span>
        </div>

        {/* An unpaid booking is on a 15-minute fuse — the most urgent thing
            that can appear on this card. */}
        {awaitingPayment && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
            <Countdown createdAt={booking.createdAt} />
            <Link
              to={`/rides/${booking.rideId}/book?seats=${String(booking.seatCount)}`}
              className={buttonStyles({ size: 'sm' })}
            >
              Complete payment
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <div className="text-sm">
            <Fare amount={booking.totalFare} />
            <span className="text-ink-muted"> total</span>
            <span className="text-ink-faint">
              {' '}
              · <Fare amount={booking.prepaidAmount} size="sm" /> paid
            </span>
          </div>
          <Link
            to={`/trips/${booking.id}`}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            View trip
          </Link>
        </div>
      </div>
    </Card>
  );
}

// The driver's view of a ride they published.
export function DriverRideCard({ ride }: { ride: RideListItem }) {
  const seatsTaken = ride.totalSeats - ride.availableSeats;

  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">
              {formatDeparture(ride.departureTime)}
              <span className="text-ink-faint"> · {formatRelativeToNow(ride.departureTime)}</span>
            </p>
            <div className="mt-1">
              <Route from={ride.originAddress} to={ride.destinationAddress} />
            </div>
          </div>
          <StatusPill status={ride.status} map={RIDE_STATUS} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Car className="size-4" aria-hidden />
            {ride.vehicle.make} {ride.vehicle.model}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {seatsTaken} of {ride.totalSeats} booked
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <div className="text-sm">
            <Fare amount={ride.farePerSeat} />
            <span className="text-ink-muted"> per seat</span>
            {ride.confirmedBookingCount > 0 && (
              <span className="text-ink-faint">
                {' '}
                · {ride.confirmedBookingCount} confirmed
              </span>
            )}
          </div>
          <Link
            to={`/rides/${ride.id}/manage`}
            className={buttonStyles({
              // An unpaid ride is invisible to passengers, so paying is the
              // only thing worth doing with it — make that the primary action
              // rather than hiding it behind "Manage".
              variant: ride.status === 'PENDING_PAYMENT' ? 'primary' : 'secondary',
              size: 'sm',
            })}
          >
            {ride.status === 'PENDING_PAYMENT' ? 'Complete payment' : 'Manage'}
          </Link>
        </div>
      </div>
    </Card>
  );
}
