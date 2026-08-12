import { z } from 'zod';

// claude.md §25: the client selects one of these five enum values; the
// server maps each to a fixed, whitelisted SQL expression
// (rideRepository.ts `sortExpression`) — never a client-supplied expression.
export const rideSortOptionSchema = z.enum([
  'DEPARTURE_TIME',
  'PICKUP_DISTANCE',
  'DESTINATION_DISTANCE',
  'FARE',
  'DRIVER_RATING',
]);
export type RideSortOption = z.infer<typeof rideSortOptionSchema>;

// claude.md §20: date + pickup + destination only — no time-range filter.
export const searchRidesQuerySchema = z.object({
  date: z.string(),
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  destinationLat: z.coerce.number().min(-90).max(90),
  destinationLng: z.coerce.number().min(-180).max(180),
  sort: rideSortOptionSchema.default('DEPARTURE_TIME'),
  // Opaque — the client only ever echoes back a cursor the server gave it.
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type SearchRidesQuery = z.infer<typeof searchRidesQuerySchema>;
