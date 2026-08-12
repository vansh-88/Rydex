import { AppError } from '../../../shared/errors/AppError.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// India has used a single fixed UTC+5:30 offset with no DST since 1945, so
// a hardcoded offset is correct here (claude.md §21 "keep timezone handling
// explicit") — not a shortcut that would break for any other timezone.
const KOLKATA_UTC_OFFSET = '+05:30';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayRangeUtc {
  start: Date;
  end: Date;
}

// claude.md §21: convert the requested calendar date (interpreted in
// Asia/Kolkata) into a UTC [start, end) range for `departure_time >= start
// AND departure_time < end` — never `WHERE DATE(departure_time) = :date`.
export function getKolkataDayRangeUtc(dateStr: string): DayRangeUtc {
  if (!DATE_ONLY_PATTERN.test(dateStr)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'date must be in YYYY-MM-DD format');
  }

  const start = new Date(`${dateStr}T00:00:00${KOLKATA_UTC_OFFSET}`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'date is not a valid calendar date');
  }

  return { start, end: new Date(start.getTime() + DAY_MS) };
}
