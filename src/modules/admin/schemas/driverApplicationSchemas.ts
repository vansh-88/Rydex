import { z } from 'zod';

// GET /admin/driver-applications only supports listing PENDING applications
// for now — there's no documented need to browse already-decided ones.
export const listDriverApplicationsStatusSchema = z.literal('PENDING').optional();

export const rejectDriverApplicationSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});
export type RejectDriverApplicationInput = z.infer<typeof rejectDriverApplicationSchema>;
