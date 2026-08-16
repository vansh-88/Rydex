// Rydex is India-only and the backend's ride search resolves its `date`
// parameter against a hard-coded Asia/Kolkata day boundary
// (backend src/modules/ride/utils/kolkataDate.ts). Every date the UI sends or
// shows therefore has to be expressed in that zone, not the browser's — a
// user searching from a different timezone must still get the Indian calendar
// day they picked, or they would silently search the wrong day.
export const APP_TIME_ZONE = 'Asia/Kolkata';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// en-CA already yields YYYY-MM-DD, which is exactly the format the search
// endpoint validates against.
export function toKolkataDateString(date: Date = new Date()): string {
  return ymdFormatter.format(date);
}

export function todayInKolkata(): string {
  return toKolkataDateString();
}

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const dayWithYearFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

// Omits the year for dates in the current year — a trip card showing
// "Fri 22 Aug" is easier to scan than "Fri 22 Aug 2026", but a past trip from
// another year needs the year to make sense.
export function formatDay(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? dayFormatter : dayWithYearFormatter).format(date);
}

// The standard departure stamp used on every ride and trip card.
export function formatDeparture(iso: string): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

// Human-readable "in 3 days" / "in 2 hours" for upcoming departures, used
// alongside (never instead of) the absolute time — a relative stamp on its own
// is ambiguous the moment the page has been open for a while.
export function formatRelativeToNow(iso: string): string {
  const deltaMs = new Date(iso).getTime() - Date.now();
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(deltaMs / 60_000);

  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');

  return relative.format(Math.round(hours / 24), 'day');
}
