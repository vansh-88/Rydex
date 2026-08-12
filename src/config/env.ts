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

  // Consumed starting Phase 6 (Map provider, claude.md §17). Geoapify is the
  // initial provider — see the Architecture Change Log (claude.md §97) for
  // why it replaces the originally-named Mapbox.
  MAP_PROVIDER: z.enum(['geoapify']).default('geoapify'),
  MAP_PROVIDER_API_KEY: z.string().min(1),

  RIDE_ORIGIN_MATCH_RADIUS_METERS: z.coerce.number().int().positive().optional(),
  RIDE_DESTINATION_MATCH_RADIUS_METERS: z.coerce.number().int().positive().optional(),
  // Consumed starting Phase 7 (commissionService, claude.md §30).
  DRIVER_COMMISSION_PERCENT: z.coerce.number().positive().default(5),
  PASSENGER_PREPAYMENT_PERCENT: z.coerce.number().optional(),
  FINAL_PAYMENT_PERCENT: z.coerce.number().optional(),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().optional(),
  DRIVER_EARLY_CANCEL_REFUND_PERCENT: z.coerce.number().optional(),
  DRIVER_CANCEL_THRESHOLD_HOURS: z.coerce.number().optional(),

  // Consumed starting Phase 6 (HeuristicFareStrategy, claude.md §29). All
  // values configurable rather than hard-coded, per §29's "avoid uncontrolled
  // multipliers" requirement.
  FARE_BASE_FARE: z.coerce.number().nonnegative().default(30),
  FARE_PRICE_PER_KM: z.coerce.number().nonnegative().default(8),
  FARE_VEHICLE_MULTIPLIER_HATCHBACK: z.coerce.number().positive().default(1.0),
  FARE_VEHICLE_MULTIPLIER_SEDAN: z.coerce.number().positive().default(1.15),
  FARE_VEHICLE_MULTIPLIER_SUV: z.coerce.number().positive().default(1.35),
  FARE_VEHICLE_MULTIPLIER_MUV: z.coerce.number().positive().default(1.3),
  // Bounds the traffic multiplier passed in as fare input, so an upstream
  // bug/bad value can't produce an unreasonable fare.
  FARE_TRAFFIC_MULTIPLIER_MIN: z.coerce.number().positive().default(0.8),
  FARE_TRAFFIC_MULTIPLIER_MAX: z.coerce.number().positive().default(2.0),
  // §29: "driver-rating influence must be bounded" — a 1-star vs 5-star
  // driver can only move the fare within this band, never further.
  FARE_RATING_MULTIPLIER_MIN: z.coerce.number().positive().default(0.95),
  FARE_RATING_MULTIPLIER_MAX: z.coerce.number().positive().default(1.05),
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
