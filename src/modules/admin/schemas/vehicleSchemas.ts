import { z } from 'zod';

// GET /admin/vehicles only supports listing PENDING vehicles for now — same
// reasoning as the driver-applications endpoint.
export const listVehiclesStatusSchema = z.literal('PENDING').optional();

export const rejectVehicleSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});
export type RejectVehicleInput = z.infer<typeof rejectVehicleSchema>;
