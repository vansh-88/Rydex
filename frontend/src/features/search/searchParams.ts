import type { PlaceValue } from '@/components/domain/PlaceInput';
import type { RideSearchSort } from '@/api/types';

// The whole search lives in the URL. That makes results shareable, the back
// button behave, and a page reload keep what the user asked for — none of
// which works if the criteria only exist in component state.
//
// Labels are stored alongside coordinates because the search response
// deliberately contains no addresses: without them the results page could not
// say where the user was even going.
export interface SearchCriteria {
  from: PlaceValue;
  to: PlaceValue;
  date: string;
  sort: RideSearchSort;
}

export const SORT_OPTIONS: { value: RideSearchSort; label: string }[] = [
  { value: 'DEPARTURE_TIME', label: 'Departure time' },
  { value: 'PICKUP_DISTANCE', label: 'Nearest pickup' },
  { value: 'DESTINATION_DISTANCE', label: 'Nearest drop-off' },
  { value: 'FARE', label: 'Lowest fare' },
  { value: 'DRIVER_RATING', label: 'Highest rated driver' },
];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

export function criteriaToSearchParams(criteria: SearchCriteria): URLSearchParams {
  return new URLSearchParams({
    from: criteria.from.label,
    fromLat: String(criteria.from.latitude),
    fromLng: String(criteria.from.longitude),
    to: criteria.to.label,
    toLat: String(criteria.to.latitude),
    toLng: String(criteria.to.longitude),
    date: criteria.date,
    sort: criteria.sort,
  });
}

// Returns null unless every required part is present and numeric — a
// half-populated URL (hand-edited, or a stale link) should show the search
// form rather than fire a request that can only 400.
export function parseSearchCriteria(params: URLSearchParams): SearchCriteria | null {
  const from = params.get('from');
  const to = params.get('to');
  const date = params.get('date');
  const fromLat = Number(params.get('fromLat'));
  const fromLng = Number(params.get('fromLng'));
  const toLat = Number(params.get('toLat'));
  const toLng = Number(params.get('toLng'));

  const coordinatesValid = [fromLat, fromLng, toLat, toLng].every(
    (value) => Number.isFinite(value) && value !== 0,
  );

  if (
    from === null ||
    to === null ||
    date === null ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !coordinatesValid
  ) {
    return null;
  }

  const sort = params.get('sort');

  return {
    from: { label: from, latitude: fromLat, longitude: fromLng },
    to: { label: to, latitude: toLat, longitude: toLng },
    date,
    sort: sort !== null && SORT_VALUES.has(sort) ? (sort as RideSearchSort) : 'DEPARTURE_TIME',
  };
}

// The shape GET /rides/search actually expects.
export function criteriaToQuery(criteria: SearchCriteria) {
  return {
    date: criteria.date,
    pickupLat: criteria.from.latitude,
    pickupLng: criteria.from.longitude,
    destinationLat: criteria.to.latitude,
    destinationLng: criteria.to.longitude,
    sort: criteria.sort,
  };
}
