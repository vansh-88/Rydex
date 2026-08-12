import { env } from '../../../config/env.js';
import type { RideSearchRow } from '../repositories/rideSearchRepository.js';
import * as rideSearchRepository from '../repositories/rideSearchRepository.js';
import type { SearchRidesQuery } from '../schemas/rideSearchSchemas.js';
import type { RideSortOption } from '../schemas/rideSearchSchemas.js';
import { getKolkataDayRangeUtc } from '../utils/kolkataDate.js';
import { decodeRideSearchCursor, encodeRideSearchCursor } from './rideSearchCursor.js';

export interface RideSearchResultDto {
  id: string;
  departureTime: string;
  pickupDistanceKm: number;
  destinationDistanceKm: number;
  farePerSeat: number;
  availableSeats: number;
  driver: { id: string; name: string; rating: number | null };
  vehicle: { type: string; model: string; ac: boolean };
}

function metersToKm(meters: number): number {
  return Math.round(meters / 100) / 10;
}

// claude.md §24: only the fields a passenger actually needs to decide/sort —
// never expose internal ids/state beyond what's shown here.
function toResultDto(row: RideSearchRow): RideSearchResultDto {
  return {
    id: row.id,
    departureTime: row.departureTime.toISOString(),
    pickupDistanceKm: metersToKm(row.pickupDistanceMeters),
    destinationDistanceKm: metersToKm(row.destinationDistanceMeters),
    farePerSeat: row.farePerSeat,
    availableSeats: row.availableSeats,
    driver: { id: row.driver.id, name: row.driver.name, rating: row.driver.ratingAverage },
    vehicle: { type: row.vehicle.type, model: row.vehicle.model, ac: row.vehicle.isAc },
  };
}

// claude.md §25: value extracted from whichever field the list is actually
// sorted on, becoming the next cursor's keyset position.
function cursorValueFor(row: RideSearchRow, sort: RideSortOption): string {
  switch (sort) {
    case 'DEPARTURE_TIME':
      return row.departureTime.toISOString();
    case 'PICKUP_DISTANCE':
      return String(row.pickupDistanceMeters);
    case 'DESTINATION_DISTANCE':
      return String(row.destinationDistanceMeters);
    case 'FARE':
      return String(row.farePerSeat);
    case 'DRIVER_RATING':
      return String(row.driver.ratingAverage ?? 6);
  }
}

export interface RideSearchResponse {
  items: RideSearchResultDto[];
  nextCursor: string | null;
}

export async function searchRides(query: SearchRidesQuery): Promise<RideSearchResponse> {
  const { start, end } = getKolkataDayRangeUtc(query.date);

  const cursor = query.cursor ? decodeRideSearchCursor(query.cursor, query.sort) : null;

  const limit = Math.min(query.limit ?? env.RIDE_SEARCH_DEFAULT_LIMIT, env.RIDE_SEARCH_MAX_LIMIT);

  // Fetch one extra row to know whether a next page exists, without a
  // separate COUNT query (claude.md §26/§93: bounded, cheap pagination).
  const rows = await rideSearchRepository.search({
    dayStart: start,
    dayEnd: end,
    pickup: { latitude: query.pickupLat, longitude: query.pickupLng },
    destination: { latitude: query.destinationLat, longitude: query.destinationLng },
    originRadiusMeters: env.RIDE_ORIGIN_MATCH_RADIUS_METERS,
    destinationRadiusMeters: env.RIDE_DESTINATION_MATCH_RADIUS_METERS,
    sort: query.sort,
    cursor,
    limit: limit + 1,
  });

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  const nextCursor =
    hasNextPage && lastRow
      ? encodeRideSearchCursor({ sort: query.sort, value: cursorValueFor(lastRow, query.sort), id: lastRow.id })
      : null;

  return { items: pageRows.map(toResultDto), nextCursor };
}
