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
