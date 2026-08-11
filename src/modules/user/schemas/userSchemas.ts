import { z } from 'zod';

// Unknown keys (role, status, ratingAverage, ratingCount, ...) are stripped
// by default zod object parsing — the client cannot smuggle server-controlled
// fields through this schema (claude.md §53).
export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    phone: z.e164().optional(),
    email: z.email().optional(),
    profileImageUrl: z.url().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
