import { z } from 'zod';

export const requestOtpSchema = z.object({
  email: z.email(),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().length(6).regex(/^\d+$/, 'otp must be 6 digits'),
  // Required only when the account doesn't exist yet — enforced in
  // authService, not here, since that depends on a DB lookup.
  name: z.string().min(1).max(100).optional(),
  phone: z.e164().optional(),
  deviceId: z.string().min(1).max(200).optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
  allDevices: z.boolean().optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;
