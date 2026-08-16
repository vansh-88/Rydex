import { z } from 'zod';

const MAX_SEATS_PER_BOOKING = 20;

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// pickup/drop are optional — omitted means "board/alight at the ride's own
// origin/destination" (claude.md §32 "where appropriate"; see the Booking
// model comment in schema.prisma for why these are plain coordinates, not
// PostGIS geography).
export const createBookingSchema = z.object({
  seatCount: z.number().int().min(1).max(MAX_SEATS_PER_BOOKING),
  pickup: coordinatesSchema.optional(),
  drop: coordinatesSchema.optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// `scope` drives both the departure-time filter and the sort direction, so
// the two can never disagree — see shared/pagination/keysetCursor.ts.
// Defaults to `upcoming`: the trips a passenger still has to act on are the
// ones worth returning when the client doesn't say.
export const listBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
