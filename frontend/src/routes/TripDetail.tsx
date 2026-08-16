import { ArrowLeft, Car, MessageSquare, Phone } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getBooking } from '@/api/endpoints/bookings';
import { getRide } from '@/api/endpoints/rides';
import { useApiQuery } from '@/api/hooks';
import { Countdown } from '@/components/domain/Countdown';
import { Fare, FareBreakdown } from '@/components/domain/Fare';
import { RatingDisplay } from '@/components/domain/StarRating';
import { ErrorState } from '@/components/domain/States';
import { StatusHint, StatusPill } from '@/components/domain/StatusPill';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { CancelBookingDialog } from '@/features/trips/CancelBookingDialog';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { BOOKING_STATUS } from '@/lib/statusMaps';

// Statuses from which the backend still allows a passenger cancel. Beyond
// these it answers 409 BOOKING_NOT_CANCELLABLE, so offering the button would
// only produce an error.
const CANCELLABLE: string[] = ['PENDING_PAYMENT', 'CONFIRMED'];

export function TripDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: booking,
    error,
    isLoading,
    refetch,
  } = useApiQuery(
    bookingId !== undefined ? `bookings:${bookingId}` : null,
    useCallback((signal: AbortSignal) => getBooking(bookingId ?? '', signal), [bookingId]),
  );

  // GET /bookings/:id returns the booking alone, so the ride is a second
  // fetch — dependent on the booking having loaded.
  const { data: ride } = useApiQuery(
    booking !== undefined ? `rides:${booking.rideId}` : null,
    useCallback(
      (signal: AbortSignal) => getRide(booking?.rideId ?? '', signal),
      [booking?.rideId],
    ),
  );

  if (isLoading) return <ListSkeleton rows={2} />;
  if (error !== undefined || booking === undefined) {
    return <ErrorState error={error} onRetry={refetch} className="my-12" />;
  }

  const canCancel = CANCELLABLE.includes(booking.status) && ride?.status !== 'STARTED';
  const awaitingPayment = booking.status === 'PENDING_PAYMENT';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate('/trips');
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My trips
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {ride?.origin.address ?? 'Your trip'}
            {ride !== undefined && (
              <>
                {' '}
                <span className="text-ink-faint">→</span> {ride.destination.address ?? ''}
              </>
            )}
          </h1>
          {ride !== undefined && (
            <p className="mt-1 text-ink-muted">
              {formatDeparture(ride.departureTime)}
              <span className="text-ink-faint"> · {formatRelativeToNow(ride.departureTime)}</span>
            </p>
          )}
        </div>
        <StatusPill status={booking.status} map={BOOKING_STATUS} />
      </div>

      <StatusHint status={booking.status} map={BOOKING_STATUS} />

      {awaitingPayment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
          <Countdown createdAt={booking.createdAt} />
          <Link
            to={`/rides/${booking.rideId}/book?seats=${String(booking.seatCount)}`}
            className={buttonStyles({ size: 'sm' })}
          >
            Complete payment
          </Link>
        </div>
      )}

      {ride !== undefined && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-700 text-sm font-medium text-white">
                  {ride.driver.name.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-ink">{ride.driver.name}</p>
                  <RatingDisplay rating={ride.driver.rating} />
                </div>
              </div>

              <Link
                to="/messages"
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                <MessageSquare className="size-4" aria-hidden />
                Message
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4 text-sm text-ink-muted">
              <Car className="size-4" aria-hidden />
              <span className="text-ink">
                {ride.vehicle.make} {ride.vehicle.model}
              </span>
              <span className="text-ink-faint">· {ride.vehicle.registrationNumber}</span>
            </div>

            {/* The driver's number is not exposed by any endpoint the
                passenger can call, so coordination happens through chat.
                Noted rather than silently omitted. */}
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              <Phone className="size-3.5" aria-hidden />
              Use messages to arrange exactly where to meet.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <FareBreakdown
            farePerSeat={booking.farePerSeat}
            seatCount={booking.seatCount}
            totalFare={booking.totalFare}
            prepaidAmount={booking.prepaidAmount}
            finalPaid={booking.status === 'COMPLETED'}
          />
        </CardBody>
      </Card>

      {canCancel && (
        <div className="flex flex-col items-start gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCancelOpen(true);
            }}
          >
            Cancel booking
          </Button>
          {booking.status === 'CONFIRMED' && (
            <p className="text-xs text-ink-faint">
              You would lose the <Fare amount={booking.prepaidAmount} size="sm" /> already paid.
            </p>
          )}
        </div>
      )}

      <CancelBookingDialog
        booking={booking}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => {
          void navigate('/trips');
        }}
      />
    </div>
  );
}
