import { env } from '../../../config/env.js';

// claude.md §30: "the exact business rule must be centralized in a
// Commission/Fee service" — this is the only place the 5% formula is
// computed; nothing else should re-derive it.
export function calculatePostingCommission(farePerSeat: number, totalSeats: number): number {
  const expectedRideValue = farePerSeat * totalSeats;
  return Math.round(expectedRideValue * (env.DRIVER_COMMISSION_PERCENT / 100));
}
