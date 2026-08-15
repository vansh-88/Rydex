import { Prisma } from '../../../generated/prisma/client.js';
import type { VehicleType } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';
import type { RideSortOption } from '../schemas/rideSearchSchemas.js';
import type { Coordinates } from './rideRepository.js';

export interface RideSearchCursorInput {
  value: string;
  id: string;
}

export interface SearchRidesParams {
  dayStart: Date;
  dayEnd: Date;
  pickup: Coordinates;
  destination: Coordinates;
  originRadiusMeters: number;
  destinationRadiusMeters: number;
  sort: RideSortOption;
  cursor: RideSearchCursorInput | null;
  limit: number;
}

export interface RideSearchRow {
  id: string;
  departureTime: Date;
  availableSeats: number;
  farePerSeat: number;
  pickupDistanceMeters: number;
  destinationDistanceMeters: number;
  driver: { id: string; name: string; ratingAverage: number | null };
  vehicle: { type: VehicleType; model: string; isAc: boolean };
}

interface RideSearchRowRaw {
  id: string;
  departure_time: Date;
  available_seats: number;
  fare_per_seat: string;
  pickup_distance_meters: number;
  destination_distance_meters: number;
  driver_id: string;
  driver_name: string;
  driver_rating_average: string | null;
  vehicle_type: VehicleType;
  vehicle_model: string;
  vehicle_is_ac: boolean;
}

function toRideSearchRow(row: RideSearchRowRaw): RideSearchRow {
  return {
    id: row.id,
    departureTime: row.departure_time,
    availableSeats: row.available_seats,
    farePerSeat: Number(row.fare_per_seat),
    pickupDistanceMeters: row.pickup_distance_meters,
    destinationDistanceMeters: row.destination_distance_meters,
    driver: {
      id: row.driver_id,
      name: row.driver_name,
      ratingAverage: row.driver_rating_average === null ? null : Number(row.driver_rating_average),
    },
    vehicle: { type: row.vehicle_type, model: row.vehicle_model, isAc: row.vehicle_is_ac },
  };
}

// A driver with no ratings yet (`driver_rating_average IS NULL`) sorts as if
// rated just above the 1-5 range, matching Postgres's own ASC-sorts-NULLS-LAST
// default while keeping the keyset comparison below total (no NULLs in the
// compared tuple — row comparison with a NULL operand doesn't behave as a
// simple total order).
const UNRATED_DRIVER_RATING_SENTINEL = 6;

// claude.md §25: the client only ever picks one of five enum values
// (validated by rideSearchSchemas.ts); this is the single place that maps
// each to a fixed SQL expression — never a client-supplied expression.
function sortExpression(sort: RideSortOption, pickupPoint: Prisma.Sql, destinationPoint: Prisma.Sql): Prisma.Sql {
  switch (sort) {
    case 'DEPARTURE_TIME':
      return Prisma.sql`r.departure_time`;
    case 'PICKUP_DISTANCE':
      return Prisma.sql`ST_Distance(r.origin, ${pickupPoint})`;
    case 'DESTINATION_DISTANCE':
      return Prisma.sql`ST_Distance(r.destination, ${destinationPoint})`;
    case 'FARE':
      return Prisma.sql`r.fare_per_seat`;
    case 'DRIVER_RATING':
      return Prisma.sql`COALESCE(u.driver_rating_average, ${UNRATED_DRIVER_RATING_SENTINEL})`;
  }
}

// The type the sort field's value is compared as in the keyset (cursor)
// WHERE clause — must match sortExpression's SQL type exactly.
function sortValueCast(sort: RideSortOption): Prisma.Sql {
  switch (sort) {
    case 'DEPARTURE_TIME':
      return Prisma.raw('::timestamptz');
    case 'PICKUP_DISTANCE':
    case 'DESTINATION_DISTANCE':
      return Prisma.raw('::double precision');
    case 'FARE':
    case 'DRIVER_RATING':
      return Prisma.raw('::numeric');
  }
}

// claude.md §20-§27: date + 10km-radius matching, PostGIS ST_DWithin/
// ST_Distance (never JS distance math, never a per-result MapProvider
// call), deterministic sort + id tie-breaker, opaque keyset-cursor
// pagination. `status IN ('OPEN','FULL') AND available_seats > 0` is the
// authoritative "bookable" condition (§22 — FULL alone is not sufficient).
export async function search(params: SearchRidesParams): Promise<RideSearchRow[]> {
  const pickupPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${params.pickup.longitude}, ${params.pickup.latitude}), 4326)::geography`;
  const destinationPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${params.destination.longitude}, ${params.destination.latitude}), 4326)::geography`;

  const sortExpr = sortExpression(params.sort, pickupPoint, destinationPoint);

  const cursorClause = params.cursor
    ? Prisma.sql`AND (${sortExpr}, r.id) > (${params.cursor.value}${sortValueCast(params.sort)}, ${params.cursor.id}::uuid)`
    : Prisma.empty;

  const query = Prisma.sql`
    SELECT
      r.id,
      r.departure_time,
      r.available_seats,
      r.fare_per_seat,
      ST_Distance(r.origin, ${pickupPoint}) AS pickup_distance_meters,
      ST_Distance(r.destination, ${destinationPoint}) AS destination_distance_meters,
      u.id AS driver_id, u.name AS driver_name, u.driver_rating_average,
      v.vehicle_type, v.model AS vehicle_model, v.is_ac AS vehicle_is_ac
    FROM rides r
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN users u ON u.id = r.driver_id
    WHERE
      r.departure_time >= ${params.dayStart}
      AND r.departure_time < ${params.dayEnd}
      AND r.status IN ('OPEN', 'FULL')
      AND r.available_seats > 0
      AND ST_DWithin(r.origin, ${pickupPoint}, ${params.originRadiusMeters})
      AND ST_DWithin(r.destination, ${destinationPoint}, ${params.destinationRadiusMeters})
      ${cursorClause}
    ORDER BY ${sortExpr} ASC, r.id ASC
    LIMIT ${params.limit}
  `;

  const rows = await prisma.$queryRaw<RideSearchRowRaw[]>(query);
  return rows.map(toRideSearchRow);
}
