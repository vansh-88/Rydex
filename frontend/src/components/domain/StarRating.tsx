import { Star } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

interface RatingDisplayProps {
  // null for a user nobody has rated yet — the backend leaves the average
  // null rather than defaulting it to a number.
  rating: number | null;
  count?: number;
  className?: string;
}

// Read-only aggregate. There is deliberately no reviews list anywhere in the
// app: GET /bookings/:id/ratings returns only ratings the caller gave or
// received, so a driver's review history simply is not fetchable. Aggregates
// are all the API can honestly support.
export function RatingDisplay({ rating, count, className }: RatingDisplayProps) {
  if (rating === null) {
    return <span className={cn('text-sm text-ink-faint', className)}>No ratings yet</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-medium text-ink">{rating.toFixed(1)}</span>
      {count !== undefined && count > 0 && (
        <span className="text-ink-faint">
          ({count})<span className="sr-only"> ratings</span>
        </span>
      )}
    </span>
  );
}

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const SCORES = [1, 2, 3, 4, 5];

// Rating input for the post-trip modal. Ratings are immutable once submitted
// (the backend rejects a second one with ALREADY_RATED), so the surrounding
// dialog says so before the user commits.
export function StarInput({ value, onChange, disabled = false }: StarInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div
      role="radiogroup"
      aria-label="Rating out of 5"
      className="flex gap-1"
      onMouseLeave={() => {
        setHovered(null);
      }}
    >
      {SCORES.map((score) => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`}
          disabled={disabled}
          onMouseEnter={() => {
            setHovered(score);
          }}
          onClick={() => {
            onChange(score);
          }}
          className="rounded p-1 transition-transform disabled:cursor-not-allowed hover:enabled:scale-110"
        >
          <Star
            className={cn(
              'size-7 transition-colors',
              score <= active ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
            )}
          />
        </button>
      ))}
    </div>
  );
}
