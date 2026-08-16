import { cancelRide } from '@/api/endpoints/rides';
import { useApiMutation } from '@/api/hooks';
import type { Ride } from '@/api/types';
import { Fare } from '@/components/domain/Fare';
import { InlineError } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

// Mirrors cancellationPolicyService on the backend: cancelling at least
// DRIVER_CANCEL_THRESHOLD_HOURS before departure returns
// DRIVER_EARLY_CANCEL_REFUND_PERCENT of the fare value, which is two fifths of
// the DRIVER_COMMISSION_PERCENT that was charged. Later than that, nothing.
const EARLY_CANCEL_THRESHOLD_HOURS = 18;
const EARLY_REFUND_FRACTION = 2 / 5;

interface CancelRideDialogProps {
  ride: Ride;
  confirmedPassengers: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}

// Cancelling a ride is the most consequential thing a driver can do: it
// refunds every paying passenger, and how much of the posting fee comes back
// depends entirely on how close to departure it is. Both facts are stated as
// numbers rather than left for the driver to discover afterwards.
export function CancelRideDialog({
  ride,
  confirmedPassengers,
  open,
  onOpenChange,
  onCancelled,
}: CancelRideDialogProps) {
  const { toast } = useToast();

  const mutation = useApiMutation(() => cancelRide(ride.id), {
    invalidates: ['rides', 'rides/mine', 'bookings'],
    onSuccess: () => {
      toast('Ride cancelled. Passengers have been notified.', 'info');
      onOpenChange(false);
      onCancelled?.();
    },
  });

  const hoursUntilDeparture =
    (new Date(ride.departureTime).getTime() - Date.now()) / (1000 * 60 * 60);
  const isEarly = hoursUntilDeparture >= EARLY_CANCEL_THRESHOLD_HOURS;
  const feeRefund = isEarly ? Math.round(ride.postingCommissionAmount * EARLY_REFUND_FRACTION) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={mutation.isPending ? () => undefined : onOpenChange}
      title="Cancel this ride?"
      description="This cannot be undone."
      footer={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Keep ride
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate(undefined);
            }}
          >
            Cancel ride
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {confirmedPassengers > 0 && (
          <p className="text-ink">
            {confirmedPassengers} {confirmedPassengers === 1 ? 'passenger has' : 'passengers have'}{' '}
            paid for a seat. They&rsquo;ll be refunded in full and notified straight away.
          </p>
        )}

        {isEarly ? (
          <p className="text-ink">
            You&rsquo;re cancelling more than {EARLY_CANCEL_THRESHOLD_HOURS} hours before
            departure, so <Fare amount={feeRefund} size="sm" /> of your{' '}
            <Fare amount={ride.postingCommissionAmount} size="sm" /> posting fee will be refunded.
          </p>
        ) : (
          <p className="text-ink">
            You&rsquo;re cancelling less than {EARLY_CANCEL_THRESHOLD_HOURS} hours before
            departure, so your <Fare amount={ride.postingCommissionAmount} size="sm" /> posting fee
            will <span className="font-medium">not</span> be refunded.
          </p>
        )}

        {mutation.error !== undefined && <InlineError error={mutation.error} />}
      </div>
    </Dialog>
  );
}
