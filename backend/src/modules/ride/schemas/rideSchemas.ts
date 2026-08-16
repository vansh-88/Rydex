import { z } from 'zod';

const MAX_WAYPOINTS = 5;
const MAX_SEATS = 20;

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// claude.md §18/§20: the client sends coordinates (already resolved via
// client-side place search/autocomplete), never free text for the backend
// to geocode — keeps ride creation from burning MapProvider quota on every
// post and matches §23's "search already has coordinates" precedent.
export const createRideSchema = z.object({
  origin: coordinatesSchema,
  originAddress: z.string().trim().min(1).max(300).optional(),
  destination: coordinatesSchema,
  destinationAddress: z.string().trim().min(1).max(300).optional(),
  waypoints: z.array(coordinatesSchema).max(MAX_WAYPOINTS).optional(),
  departureTime: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    message: 'departureTime must be in the future',
  }),
  vehicleId: z.uuid(),
  availableSeats: z.number().int().min(1).max(MAX_SEATS),
});
export type CreateRideInput = z.infer<typeof createRideSchema>;

// `scope` drives both the departure-time filter and the sort direction, so
// the two can never disagree — see shared/pagination/keysetCursor.ts.
export const listMyRidesQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListMyRidesQuery = z.infer<typeof listMyRidesQuerySchema>;
