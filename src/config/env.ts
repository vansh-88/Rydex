import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  // Consumed starting Phase 2 (Prisma/Postgres connection).
  DATABASE_URL: z.string().min(1),

  // Consumed starting Phase 3 (Auth/OTP/Redis).
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Resend stays optional even in Phase 3: without a key, auth falls back
  // to a console email provider for local dev (see infrastructure/resend).
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  // claude.md §9: OTP TTL/attempts/cooldown must be configurable.
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

  // claude.md §9/§49: per-IP rate limiting on OTP request/verify endpoints.
  OTP_REQUEST_IP_MAX: z.coerce.number().int().positive().default(10),
  OTP_REQUEST_IP_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  OTP_VERIFY_IP_MAX: z.coerce.number().int().positive().default(20),
  OTP_VERIFY_IP_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),

  // Consumed starting Phase 4.5/5 (Cloudinary document uploads).
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Consumed starting later phases — optional here, tightened to required at
  // the point the module that needs them is implemented (claude.md §90).
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  PAYMENT_PROVIDER_KEY: z.string().optional(),
  PAYMENT_PROVIDER_SECRET: z.string().optional(),
  MAP_PROVIDER_API_KEY: z.string().optional(),
  RIDE_ORIGIN_MATCH_RADIUS_METERS: z.coerce.number().int().positive().optional(),
  RIDE_DESTINATION_MATCH_RADIUS_METERS: z.coerce.number().int().positive().optional(),
  DRIVER_COMMISSION_PERCENT: z.coerce.number().optional(),
  PASSENGER_PREPAYMENT_PERCENT: z.coerce.number().optional(),
  FINAL_PAYMENT_PERCENT: z.coerce.number().optional(),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().optional(),
  DRIVER_EARLY_CANCEL_REFUND_PERCENT: z.coerce.number().optional(),
  DRIVER_CANCEL_THRESHOLD_HOURS: z.coerce.number().optional(),
});

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment configuration:', z.flattenError(parsed.error).fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
