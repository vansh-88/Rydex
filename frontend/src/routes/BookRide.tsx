import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { createBooking, getBooking } from '@/api/endpoints/bookings';
import { getRide } from '@/api/endpoints/rides';
import { useApiQuery } from '@/api/hooks';
import type { Booking } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Countdown } from '@/components/domain/Countdown';
import { Fare, FareBreakdown } from '@/components/domain/Fare';
import { ErrorState } from '@/components/domain/States';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { PaymentStatus } from '@/features/payment/PaymentStatus';
import { usePaymentFlow } from '@/features/payment/usePaymentFlow';
import { clearIdempotencyKey, idempotencyKeyFor } from '@/lib/idempotency';
import { formatDeparture } from '@/lib/kolkataDate';
import { formatRupeesPlain } from '@/lib/money';
import { parseSearchCriteria } from '@/features/search/searchParams';

export function BookRide() {
  const { rideId } = useParams<{ rideId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const seatCount = Math.max(1, Number(searchParams.get('seats') ?? '1'));
  const criteria = parseSearchCriteria(searchParams);

  const {
    data: ride,
    error: rideError,
    isLoading,
    refetch,
  } = useApiQuery(
    rideId !== undefined ? `rides:${rideId}` : null,
    useCallback((signal: AbortSignal) => getRide(rideId ?? '', signal), [rideId]),
  );

  // Stable across retries and reloads: the same ride and seat count is the
  // same intent, so a repeated request is replayed rather than charged twice.
  const intent = `book:${rideId ?? ''}:${String(seatCount)}`;

  const flow = usePaymentFlow<Booking>({
    createOrder: async () => {
      const result = await createBooking(
        rideId ?? '',
        {
          seatCount,
          // Sent only when the user searched for specific points — otherwise
          // the backend defaults to the ride's own origin and destination.
          ...(criteria !== null
            ? {
                pickup: { latitude: criteria.from.latitude, longitude: criteria.from.longitude },
                drop: { latitude: criteria.to.latitude, longitude: criteria.to.longitude },
              }
            : {}),
        },
        idempotencyKeyFor(intent),
      );
      return {
        order: result.paymentOrder,
        entityId: result.booking.id,
        entity: result.booking,
      };
    },
    pollEntity: (bookingId, signal) => getBooking(bookingId, signal),
    isSettled: (booking) => booking.status === 'CONFIRMED',
    isFailed: (booking) => booking.status === 'PAYMENT_FAILED',
    description: 'Seat reservation',
    prefill: { name: user?.name, email: user?.email, contact: user?.phone },
    invalidates: ['bookings', 'rides'],
  });

  const booking = flow.entity;

  // Once the booking is paid the intent is finished, so the stored key is
  // dropped: booking this same ride again later is a genuinely new request
  // and must not be replayed as this one.
  useEffect(() => {
    if (flow.phase === 'succeeded') clearIdempotencyKey(intent);
  }, [flow.phase, intent]);

  const successAction = useMemo(
    () => (
      <Link to="/trips" className={buttonStyles()}>
        View my trips
      </Link>
    ),
    [],
  );

  if (isLoading) return <ListSkeleton rows={2} />;
  if (rideError !== undefined || ride === undefined) {
    return <ErrorState error={rideError} onRetry={refetch} className="my-12" />;
  }

  const totalFare = ride.farePerSeat * seatCount;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to ride
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-ink">Confirm your booking</h1>
        <p className="mt-1 text-ink-muted">
          {ride.origin.address ?? 'Pickup'} → {ride.destination.address ?? 'Drop-off'}
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Departure</dt>
              <dd className="text-ink">{formatDeparture(ride.departureTime)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Driver</dt>
              <dd className="text-ink">{ride.driver.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Vehicle</dt>
              <dd className="text-ink">
                {ride.vehicle.make} {ride.vehicle.model}
              </dd>
            </div>
          </dl>

          <div className="border-t border-border-subtle pt-4">
            <FareBreakdown
              farePerSeat={ride.farePerSeat}
              seatCount={seatCount}
              totalFare={booking?.totalFare ?? totalFare}
              // Once the booking exists, the authoritative figure is whatever
              // the server locked in — never the client's preview of it.
              prepaidAmount={booking?.prepaidAmount ?? Math.round((totalFare * 10) / 100)}
            />
          </div>
        </CardBody>
      </Card>

      {/* The seat is held for 15 minutes from creation; once a booking exists
          and is unpaid, that deadline is the most important thing on screen. */}
      {booking !== undefined && booking.status === 'PENDING_PAYMENT' && (
        <div className="flex items-center justify-between rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
          <span className="text-sm text-ink">Your seat is being held</span>
          <Countdown createdAt={booking.createdAt} />
        </div>
      )}

      <PaymentStatus
        phase={flow.phase}
        error={flow.error}
        isStub={flow.isStub}
        onRetry={flow.start}
        successTitle="Your seat is confirmed"
        successBody={
          booking !== undefined
            ? `You've paid ${formatRupeesPlain(booking.prepaidAmount)}. The remaining ${formatRupeesPlain(booking.totalFare - booking.prepaidAmount)} is due after the trip.`
            : undefined
        }
        successAction={successAction}
      />

      {flow.phase === 'idle' && (
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={flow.start}>
            Pay <Fare amount={Math.round((totalFare * 10) / 100)} size="sm" /> and reserve
          </Button>
          <p className="text-center text-xs text-ink-faint">
            You&rsquo;ll be charged the remaining amount only after the trip is completed.
            Cancelling later forfeits what you pay now.
          </p>
        </div>
      )}

    </div>
  );
}
