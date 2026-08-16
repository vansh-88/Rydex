import type { Booking } from '@/api/types';
import { useApiMutation } from '@/api/hooks';
import { cancelBooking } from '@/api/endpoints/bookings';
import { Fare } from '@/components/domain/Fare';
import { InlineError } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

interface CancelBookingDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: (booking: Booking) => void;
}

// Cancelling is not free, and the amount is not obvious: a passenger who has
// paid forfeits the 10% prepayment outright — the backend creates no refund
// transaction on this path. A dialog that only asks "are you sure?" would be
// hiding a real cost, so this one states the number.
export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  onCancelled,
}: CancelBookingDialogProps) {
  const { toast } = useToast();

  const mutation = useApiMutation(() => cancelBooking(booking.id), {
    // Both the trip lists and the ride itself change — the seat goes back.
    invalidates: ['bookings', 'rides'],
    onSuccess: (updated) => {
      toast('Your booking has been cancelled.', 'info');
      onOpenChange(false);
      onCancelled?.(updated);
    },
  });

  // Nothing has been charged yet while a booking is still PENDING_PAYMENT, so
  // promising a loss there would be simply wrong.
  const hasPaid = booking.status === 'CONFIRMED';
  const remaining = booking.totalFare - booking.prepaidAmount;

  return (
    <Dialog
      open={open}
      onOpenChange={mutation.isPending ? () => undefined : onOpenChange}
      title="Cancel this booking?"
      description="Your seat will be released to other passengers."
      footer={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Keep booking
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate(undefined);
            }}
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {hasPaid ? (
          <p className="text-ink">
            You&rsquo;ll lose the <Fare amount={booking.prepaidAmount} size="sm" /> you already
            paid. The remaining <Fare amount={remaining} size="sm" /> was never charged.
          </p>
        ) : (
          <p className="text-ink">
            You haven&rsquo;t been charged for this booking, so nothing will be taken.
          </p>
        )}

        <p className="text-ink-muted">This cannot be undone.</p>

        {mutation.error !== undefined && <InlineError error={mutation.error} />}
      </div>
    </Dialog>
  );
}
