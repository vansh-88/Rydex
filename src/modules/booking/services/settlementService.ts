import { env } from '../../../config/env.js';

// claude.md §41: remaining fare after the 10% prepayment, derived from the
// fare locked on the booking at booking-creation time — never recalculated
// from current pricing configuration.
export function calculateRemainingFare(totalFare: number, prepaidAmount: number): number {
  return Math.round(totalFare - prepaidAmount);
}

export interface Settlement {
  platformCommission: number;
  driverShare: number;
}

// claude.md §41/§84: "application commission is calculated exactly once" —
// this is the one place. There is no wallet/payout system in scope
// (claude.md §6) and the TransactionType enum is closed, so this isn't
// persisted as a new transaction row — callers log the result for a future
// payout module to consume.
export function calculateSettlement(totalFare: number): Settlement {
  const platformCommission = Math.round(totalFare * (env.PLATFORM_COMMISSION_PERCENT / 100));
  return { platformCommission, driverShare: totalFare - platformCommission };
}
