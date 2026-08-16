// Rydex surfaces 6 ride statuses and 5 booking statuses on nearly every
// screen, plus three verification states. Defining them once here — label AND
// colour together — is what stops "PENDING_PAYMENT" leaking into the UI in
// one place and reading as "Awaiting payment" in another.
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  // Shown where there is room to explain what the state actually means —
  // trip detail headers, empty states. Most of these states are consequences
  // of money moving, and a bare label doesn't tell a user what to do next.
  hint?: string;
}

// Ride statuses, from the driver's point of view (the only role that sees
// most of them — a passenger sees a ride's status only on trip detail).
export const RIDE_STATUS: Record<string, StatusMeta> = {
  PENDING_PAYMENT: {
    label: 'Awaiting payment',
    tone: 'warning',
    hint: 'This ride is not visible to passengers until the posting fee is paid.',
  },
  OPEN: { label: 'Open', tone: 'success', hint: 'Passengers can book seats on this ride.' },
  FULL: { label: 'Full', tone: 'info', hint: 'Every seat on this ride is booked.' },
  STARTED: { label: 'In progress', tone: 'info', hint: 'This ride is under way.' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

// Booking statuses, from the passenger's point of view.
export const BOOKING_STATUS: Record<string, StatusMeta> = {
  PENDING_PAYMENT: {
    label: 'Awaiting payment',
    tone: 'warning',
    hint: 'Your seat is held until payment completes. Pay now to confirm it.',
  },
  CONFIRMED: { label: 'Confirmed', tone: 'success', hint: 'Your seat is booked.' },
  PAYMENT_FAILED: {
    label: 'Payment failed',
    tone: 'danger',
    hint: 'The payment did not go through and the seat was released.',
  },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
};

// Shared by vehicle verification and vehicle/user document review.
export const VERIFICATION_STATUS: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Under review',
    tone: 'warning',
    hint: 'A Rydex reviewer is checking your documents. This is a manual review.',
  },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

// Driver licence adds a NONE state the vehicle flow has no equivalent of.
export const DRIVER_LICENSE_STATUS: Record<string, StatusMeta> = {
  NONE: { label: 'Not submitted', tone: 'neutral' },
  ...VERIFICATION_STATUS,
};

// Any unmapped value still renders as something readable rather than blank —
// a new backend enum value should degrade, not break the page.
export function statusMeta(map: Record<string, StatusMeta>, status: string): StatusMeta {
  return map[status] ?? { label: humanizeEnum(status), tone: 'neutral' };
}

function humanizeEnum(value: string): string {
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
