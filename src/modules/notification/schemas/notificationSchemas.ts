import { z } from 'zod';

// claude.md §45: platform is one of the three DevicePlatform enum values.
export const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1).max(4096),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
