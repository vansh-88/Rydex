import { env } from '../../../config/env.js';

export interface DriverCancellationRefund {
  refundAmount: number;
  retainedAmount: number;
  isEarlyCancellation: boolean;
}

const MS_PER_HOUR = 60 * 60 * 1000;

// claude.md §31/§85: "the exact business rule must be centralized" — this is
// the only place the driver posting-fee cancellation policy is computed.
// >= DRIVER_CANCEL_THRESHOLD_HOURS before departure: 2 of the 5 percentage
// points that made up the commission are refunded, 3 retained. < threshold:
// the full commission is retained. The doc's own arithmetic (2%+3%=5%)
// confirms "2%"/"3%" are percentage points of the same ride-value base the
// 5% commission was computed from (§85: "2 percentage points of posting
// fee"), not "2% of the fee amount" — so the refund share of the
// already-calculated commission is (refundPercent / commissionPercent).
export function calculateDriverCancellationRefund(
  postingCommissionAmount: number,
  departureTime: Date,
  now: Date = new Date(),
): DriverCancellationRefund {
  const isEarlyCancellation = departureTime.getTime() - now.getTime() >= env.DRIVER_CANCEL_THRESHOLD_HOURS * MS_PER_HOUR;

  if (!isEarlyCancellation) {
    return { refundAmount: 0, retainedAmount: postingCommissionAmount, isEarlyCancellation };
  }

  const refundAmount = Math.round(
    postingCommissionAmount * (env.DRIVER_EARLY_CANCEL_REFUND_PERCENT / env.DRIVER_COMMISSION_PERCENT),
  );
  // Derived as the complement, not an independent calculation — guarantees
  // refund + retained === postingCommissionAmount exactly (claude.md §84:
  // "refund cannot exceed refundable amount") regardless of future edits to
  // the two percentage env vars.
  return { refundAmount, retainedAmount: postingCommissionAmount - refundAmount, isEarlyCancellation };
}
