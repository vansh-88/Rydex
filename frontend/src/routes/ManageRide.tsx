import { ArrowLeft, MessageSquare, Phone, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { completeRide, getRide, listRideBookings, startRide } from '@/api/endpoints/rides';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { RideBooking } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Fare } from '@/components/domain/Fare';
import { RatingDisplay } from '@/components/domain/StarRating';
import { EmptyState, ErrorState, InlineError } from '@/components/domain/States';
import { StatusHint, StatusPill } from '@/components/domain/StatusPill';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { PublishPayment } from '@/features/payment/PublishPayment';
import { RatingDialog } from '@/features/ratings/RatingDialog';
import { CancelRideDialog } from '@/features/trips/CancelRideDialog';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { BOOKING_STATUS, RIDE_STATUS } from '@/lib/statusMaps';

export function ManageRide() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: ride,
    error,
    isLoading,
    refetch,
  } = useApiQuery(
    rideId !== undefined ? `rides:${rideId}` : null,
    useCallback((signal: AbortSignal) => getRide(rideId ?? '', signal), [rideId]),
  );

  const { data: bookings, refetch: refetchBookings } = useApiQuery(
    rideId !== undefined ? `rides:${rideId}:bookings` : null,
    useCallback((signal: AbortSignal) => listRideBookings(rideId ?? '', signal), [rideId]),
  );

  const start = useApiMutation(() => startRide(rideId ?? ''), {
    invalidates: ['rides', 'rides/mine'],
    onSuccess: () => {
      toast('Ride started. Have a good trip.', 'success');
      refetch();
    },
  });

  const complete = useApiMutation(() => completeRide(rideId ?? ''), {
    invalidates: ['rides', 'rides/mine', 'bookings'],
    onSuccess: () => {
      // Completion is also what creates each passenger's final payment order
      // on the backend, so their trips change too.
      toast('Ride completed. Passengers can now settle the balance.', 'success');
      refetch();
      refetchBookings();
    },
  });

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined || ride === undefined) {
    return <ErrorState error={error} onRetry={refetch} className="my-12" />;
  }

  if (ride.driverId !== user?.id) {
    return (
      <EmptyState
        title="This isn't your ride"
        description="Only the driver can manage a ride."
        className="my-12"
      />
    );
  }

  const passengers = bookings?.items ?? [];
  const confirmed = passengers.filter(
    (booking) => booking.status === 'CONFIRMED' || booking.status === 'COMPLETED',
  );

  // Mirrors the backend's own conditional updates: start only from OPEN/FULL,
  // complete only from STARTED, cancel only before the trip begins. Offering
  // a button the server would reject with INVALID_RIDE_STATE just produces a
  // confusing error.
  const canStart = ride.status === 'OPEN' || ride.status === 'FULL';
  const canComplete = ride.status === 'STARTED';
  const canCancel = ['PENDING_PAYMENT', 'OPEN', 'FULL'].includes(ride.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate('/trips?role=driving');
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My rides
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {ride.origin.address ?? 'Pickup'} <span className="text-ink-faint">→</span>{' '}
            {ride.destination.address ?? 'Drop-off'}
          </h1>
          <p className="mt-1 text-ink-muted">
            {formatDeparture(ride.departureTime)}
            <span className="text-ink-faint"> · {formatRelativeToNow(ride.departureTime)}</span>
          </p>
        </div>
        <StatusPill status={ride.status} map={RIDE_STATUS} />
      </div>

      <StatusHint status={ride.status} map={RIDE_STATUS} />

      {ride.status === 'PENDING_PAYMENT' && (
        <PublishPayment
          ride={ride}
          onSettled={() => {
            refetch();
          }}
        />
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {ride.totalSeats - ride.availableSeats} of {ride.totalSeats} seats booked
            </span>
            <span>
              <Fare amount={ride.farePerSeat} size="sm" /> per seat
            </span>
            <span className="text-ink-faint">
              {ride.status === 'PENDING_PAYMENT' ? 'Posting fee due: ' : 'Posting fee paid: '}
              <Fare amount={ride.postingCommissionAmount} size="sm" />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {canStart && (
              <Button
                loading={start.isPending}
                onClick={() => {
                  start.mutate(undefined);
                }}
              >
                Start ride
              </Button>
            )}
            {canComplete && (
              <Button
                loading={complete.isPending}
                onClick={() => {
                  complete.mutate(undefined);
                }}
              >
                Complete ride
              </Button>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => {
                  setCancelOpen(true);
                }}
              >
                Cancel ride
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {(start.error ?? complete.error) !== undefined && (
        <InlineError error={start.error ?? complete.error} />
      )}

      {/* Completing is what triggers each passenger's remaining 90% payment
          order, so the driver should know that is what the button does. */}
      {canComplete && (
        <p className="text-sm text-ink-muted">
          Completing the ride asks each passenger to pay the remaining balance.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">
          Passengers{passengers.length > 0 && ` (${String(passengers.length)})`}
        </h2>

        {passengers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No bookings yet"
            description="Passengers who book a seat on this ride will appear here."
          />
        ) : (
          <div className="space-y-3">
            {passengers.map((booking) => (
              <PassengerCard
                key={booking.id}
                booking={booking}
                rideCompleted={ride.status === 'COMPLETED'}
                myUserId={user.id}
              />
            ))}
          </div>
        )}
      </section>

      <CancelRideDialog
        ride={ride}
        confirmedPassengers={confirmed.length}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => {
          void navigate('/trips?role=driving');
        }}
      />
    </div>
  );
}

function PassengerCard({
  booking,
  rideCompleted,
  myUserId,
}: {
  booking: RideBooking;
  rideCompleted: boolean;
  myUserId: string;
}) {
  const [rateOpen, setRateOpen] = useState(false);

  // The backend allows a rating only once the ride is COMPLETED and the
  // booking reached CONFIRMED or COMPLETED.
  const rateable =
    rideCompleted && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-700 text-sm font-medium text-white">
            {booking.passenger.name.trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-medium text-ink">{booking.passenger.name}</p>
            <RatingDisplay rating={booking.passenger.rating} />
          </div>
        </div>
        <StatusPill status={booking.status} map={BOOKING_STATUS} />
      </CardHeader>

      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
          <span>
            {booking.seatCount} {booking.seatCount === 1 ? 'seat' : 'seats'}
          </span>
          <span>
            <Fare amount={booking.totalFare} size="sm" /> total
          </span>
          <span className="text-ink-faint">
            <Fare amount={booking.prepaidAmount} size="sm" /> paid
          </span>
        </div>

        {/* Released by the backend only once the booking is CONFIRMED — an
            unpaid hold does not hand out a phone number. */}
        {booking.passenger.phone !== null ? (
          <a
            href={`tel:${booking.passenger.phone}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent-700 hover:text-accent-800"
          >
            <Phone className="size-3.5" aria-hidden />
            {booking.passenger.phone}
          </a>
        ) : (
          <p className="text-xs text-ink-faint">
            Contact details appear once this passenger has paid.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link to="/messages" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            <MessageSquare className="size-4" aria-hidden />
            Message
          </Link>
          {rateable && (
            <Button
              size="sm"
              onClick={() => {
                setRateOpen(true);
              }}
            >
              Rate passenger
            </Button>
          )}
        </div>
      </CardBody>

      <RatingDialog
        bookingId={booking.id}
        rateeName={booking.passenger.name}
        open={rateOpen}
        onOpenChange={setRateOpen}
        onSubmitted={() => {
          void myUserId;
        }}
      />
    </Card>
  );
}
