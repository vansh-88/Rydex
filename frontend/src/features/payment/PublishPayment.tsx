import { useEffect } from 'react';

import { getRide } from '@/api/endpoints/rides';
import type { Ride, RideDetail } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Fare } from '@/components/domain/Fare';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

import { PaymentStatus } from './PaymentStatus';
import { usePaymentFlow } from './usePaymentFlow';

interface PublishPaymentProps {
  ride: RideDetail;
  onSettled?: () => void;
}

// Paying the posting fee for a ride that was created but never paid for.
//
// A driver who closes the checkout window during "Offer a ride" leaves a real
// ride row at PENDING_PAYMENT — invisible in search, with a valid payment order
// attached. Without this screen that ride is unrecoverable: the order exists
// and nothing can reach it. (It was unreachable at all until
// `postingCommissionOrderId` was added to the ride DTO.)
//
// Like FinalPayment, nothing is created here — the order was made when the
// ride was, so there is no request to be idempotent about.
export function PublishPayment({ ride, onSettled }: PublishPaymentProps) {
  const { user } = useAuth();

  const flow = usePaymentFlow<Ride>({
    createOrder: () =>
      Promise.resolve({
        order: {
          providerOrderId: ride.postingCommissionOrderId,
          amount: ride.postingCommissionAmount,
          currency: 'INR',
        },
        entityId: ride.id,
        entity: ride,
      }),
    pollEntity: (rideId, signal) => getRide(rideId, signal),
    // The posting-commission webhook is what moves the ride out of
    // PENDING_PAYMENT and makes it visible in search.
    isSettled: (current) => current.status === 'OPEN',
    description: 'Ride posting fee',
    prefill: { name: user?.name, email: user?.email, contact: user?.phone },
    invalidates: ['rides', 'rides/mine'],
  });

  useEffect(() => {
    if (flow.phase === 'succeeded') onSettled?.();
  }, [flow.phase, onSettled]);

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardBody className="space-y-4">
        <div>
          <p className="font-medium text-ink">This ride isn&rsquo;t published yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Passengers can&rsquo;t see it or book it until the posting fee is paid. Nothing has been
            charged so far.
          </p>
        </div>

        <div className="flex items-baseline justify-between border-t border-amber-200 pt-3">
          <span className="text-sm text-ink-muted">Posting fee</span>
          <Fare amount={ride.postingCommissionAmount} size="lg" />
        </div>

        <PaymentStatus
          phase={flow.phase}
          error={flow.error}
          isStub={flow.isStub}
          onRetry={flow.start}
          successTitle="Your ride is live"
          successBody="Passengers can now find and book seats on it."
        />

        {flow.phase === 'idle' && (
          <div className="space-y-2">
            <Button size="lg" className="w-full" onClick={flow.start}>
              Pay <Fare amount={ride.postingCommissionAmount} size="sm" /> and publish
            </Button>
            <p className="text-center text-xs text-ink-faint">
              Or cancel the ride below — you won&rsquo;t be charged anything.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
