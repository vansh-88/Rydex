import { useEffect } from 'react';

import { getBooking } from '@/api/endpoints/bookings';
import type { Booking } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Fare } from '@/components/domain/Fare';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

import { PaymentStatus } from './PaymentStatus';
import { usePaymentFlow } from './usePaymentFlow';

interface FinalPaymentProps {
  booking: Booking;
  onSettled?: () => void;
}

// The remaining 90%, due after the trip.
//
// Unlike the other two payment moments, nothing is created here: the backend
// already made this order when the driver completed the ride
// (finalPaymentService), and stored it on the booking. So `createOrder` only
// hands the existing order to the checkout — there is no endpoint to call and
// nothing to be idempotent about.
//
// This flow was unreachable until `finalPaymentOrderId` was added to the
// booking DTO; the order existed in the database with no way for any client
// to see it.
export function FinalPayment({ booking, onSettled }: FinalPaymentProps) {
  const { user } = useAuth();
  const remaining = booking.totalFare - booking.prepaidAmount;

  const flow = usePaymentFlow<Booking>({
    createOrder: () => {
      if (booking.finalPaymentOrderId === null) {
        throw new Error('No final payment is due for this booking');
      }
      return Promise.resolve({
        order: {
          providerOrderId: booking.finalPaymentOrderId,
          amount: remaining,
          currency: 'INR',
        },
        entityId: booking.id,
        entity: booking,
      });
    },
    pollEntity: (bookingId, signal) => getBooking(bookingId, signal),
    // The final-payment webhook moves the booking CONFIRMED -> COMPLETED.
    isSettled: (current) => current.status === 'COMPLETED',
    description: 'Remaining trip fare',
    prefill: { name: user?.name, email: user?.email, contact: user?.phone },
    invalidates: ['bookings'],
  });

  // Effect, not render: notifying the parent is a side effect and must not
  // happen while rendering.
  useEffect(() => {
    if (flow.phase === 'succeeded') onSettled?.();
  }, [flow.phase, onSettled]);

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardBody className="space-y-4">
        <div>
          <p className="font-medium text-ink">Balance due</p>
          <p className="mt-1 text-sm text-ink-muted">
            Your trip is complete. The remaining fare is now payable — you paid{' '}
            <Fare amount={booking.prepaidAmount} size="sm" /> when you booked.
          </p>
        </div>

        <div className="flex items-baseline justify-between border-t border-amber-200 pt-3">
          <span className="text-sm text-ink-muted">Remaining</span>
          <Fare amount={remaining} size="lg" />
        </div>

        <PaymentStatus
          phase={flow.phase}
          error={flow.error}
          isStub={flow.isStub}
          onRetry={flow.start}
          successTitle="Trip settled"
          successBody="Thanks — nothing else is owed for this trip."
        />

        {flow.phase === 'idle' && (
          <Button size="lg" className="w-full" onClick={flow.start}>
            Pay <Fare amount={remaining} size="sm" />
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
