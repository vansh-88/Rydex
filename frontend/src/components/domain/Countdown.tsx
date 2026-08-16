import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

// The backend holds a reserved seat for BOOKING_PAYMENT_TTL_SECONDS (900) and
// a BullMQ job releases it when that expires. That deadline is invisible
// unless the UI shows it, and a passenger who wanders off mid-checkout comes
// back to a silently cancelled booking. So every screen where a booking is
// PENDING_PAYMENT shows the remaining time.
const BOOKING_HOLD_SECONDS = 900;

function remainingSeconds(createdAt: string): number {
  const deadline = new Date(createdAt).getTime() + BOOKING_HOLD_SECONDS * 1000;
  return Math.max(0, Math.round((deadline - Date.now()) / 1000));
}

export function useBookingCountdown(createdAt: string): number {
  const [seconds, setSeconds] = useState(() => remainingSeconds(createdAt));

  useEffect(() => {
    setSeconds(remainingSeconds(createdAt));
    const timer = window.setInterval(() => {
      const next = remainingSeconds(createdAt);
      setSeconds(next);
      if (next === 0) window.clearInterval(timer);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [createdAt]);

  return seconds;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface CountdownProps {
  createdAt: string;
  onExpire?: () => void;
  className?: string;
}

export function Countdown({ createdAt, onExpire, className }: CountdownProps) {
  const seconds = useBookingCountdown(createdAt);
  const expired = seconds === 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  if (expired) {
    return (
      <span className={cn('text-sm font-medium text-red-700', className)}>
        Hold expired — this seat has been released
      </span>
    );
  }

  return (
    <span
      className={cn(
        'text-sm font-medium',
        // Under two minutes the outcome is genuinely at risk, so the tone
        // changes from informational to urgent.
        seconds < 120 ? 'text-red-700' : 'text-amber-800',
        className,
      )}
    >
      <span aria-hidden>{formatClock(seconds)}</span>
      <span className="sr-only">
        {Math.ceil(seconds / 60)} minutes remaining to complete payment
      </span>
      <span className="ml-1.5 font-normal text-ink-muted">left to pay</span>
    </span>
  );
}
