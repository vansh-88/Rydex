import { cn } from '@/lib/cn';
import { formatRupees } from '@/lib/money';

interface FareProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-base font-medium',
  lg: 'text-2xl font-semibold',
};

export function Fare({ amount, size = 'md', className }: FareProps) {
  return <span className={cn(SIZES[size], className)}>{formatRupees(amount)}</span>;
}

interface FareBreakdownProps {
  farePerSeat: number;
  seatCount: number;
  totalFare: number;
  prepaidAmount: number;
  // True once the trip is over and the remaining amount has actually been
  // charged, which changes "after the trip" to "paid".
  finalPaid?: boolean;
  className?: string;
}

// The 10/90 split is the single most surprising thing about booking on Rydex:
// a passenger pays a small deposit now and the rest after travelling. Showing
// only a total would set the wrong expectation at exactly the moment the user
// is deciding whether to commit, so the split is never collapsed.
export function FareBreakdown({
  farePerSeat,
  seatCount,
  totalFare,
  prepaidAmount,
  finalPaid = false,
  className,
}: FareBreakdownProps) {
  const remaining = totalFare - prepaidAmount;

  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-muted">
          {formatRupees(farePerSeat)} × {seatCount} {seatCount === 1 ? 'seat' : 'seats'}
        </dt>
        <dd className="text-ink">
          <Fare amount={totalFare} />
        </dd>
      </div>

      <div className="flex items-baseline justify-between gap-4 border-t border-border-subtle pt-2">
        <dt className="font-medium text-ink">Pay now to reserve</dt>
        <dd className="font-semibold text-ink">
          <Fare amount={prepaidAmount} />
        </dd>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-muted">{finalPaid ? 'Paid after the trip' : 'Due after the trip'}</dt>
        <dd className="text-ink-muted">
          <Fare amount={remaining} size="sm" />
        </dd>
      </div>
    </dl>
  );
}

interface PostingFeeProps {
  farePerSeat: number;
  totalSeats: number;
  commissionAmount: number;
}

// The driver-side equivalent, shown before publishing. A driver who does not
// realise publishing costs money will abandon at the payment step, so the
// arithmetic is spelled out rather than just the amount.
export function PostingFeeBreakdown({
  farePerSeat,
  totalSeats,
  commissionAmount,
}: PostingFeeProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-muted">Fare per seat</dt>
        <dd className="text-ink">
          <Fare amount={farePerSeat} />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-muted">
          If all {totalSeats} {totalSeats === 1 ? 'seat sells' : 'seats sell'}
        </dt>
        <dd className="text-ink">
          <Fare amount={farePerSeat * totalSeats} />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-border-subtle pt-2">
        <dt className="font-medium text-ink">You pay now to publish</dt>
        <dd className="font-semibold text-ink">
          <Fare amount={commissionAmount} />
        </dd>
      </div>
    </dl>
  );
}
