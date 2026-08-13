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
  // Consumed starting Phase 10 (RazorpayProvider, claude.md §37/§40). Stay
  // optional — without them, the factory falls back to StubPaymentProvider
  // for local dev, same pattern as Resend's console fallback.
  PAYMENT_PROVIDER_KEY: z.string().optional(),
  PAYMENT_PROVIDER_SECRET: z.string().optional(),
  // Separate from PAYMENT_PROVIDER_SECRET on purpose — Razorpay signs
  // webhooks with a distinct secret configured in its dashboard, not the API
  // key secret used for order/checkout signature verification. Required
  // even in stub mode: StubPaymentProvider verifies webhook signatures for
  // real (HMAC-SHA256) using this same secret, so local testing without a
  // real Razorpay account still exercises genuine signature verification.
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().min(1),

  // claude.md §39: how long a claimed Idempotency-Key stays valid.
  IDEMPOTENCY_KEY_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // Consumed starting Phase 6 (Map provider, claude.md §17). Geoapify is the
  // initial provider — see the Architecture Change Log (claude.md §97) for
  // why it replaces the originally-named Mapbox.
  MAP_PROVIDER: z.enum(['geoapify']).default('geoapify'),
  MAP_PROVIDER_API_KEY: z.string().min(1),

  // Consumed starting Phase 8 (ride search, claude.md §20/§85).
  RIDE_ORIGIN_MATCH_RADIUS_METERS: z.coerce.number().int().positive().default(10000),
  RIDE_DESTINATION_MATCH_RADIUS_METERS: z.coerce.number().int().positive().default(10000),
  // claude.md §26: cursor-pagination limit, configurable and capped server-side.
  RIDE_SEARCH_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  RIDE_SEARCH_MAX_LIMIT: z.coerce.number().int().positive().default(50),
  // Consumed starting Phase 7 (commissionService, claude.md §30).
  DRIVER_COMMISSION_PERCENT: z.coerce.number().positive().default(5),
  // Consumed starting Phase 9 (bookingService, claude.md §34).
  PASSENGER_PREPAYMENT_PERCENT: z.coerce.number().positive().default(10),
  // Consumed starting Phase 11 (settlementService/cancellationPolicyService,
  // claude.md §31/§41/§85).
  FINAL_PAYMENT_PERCENT: z.coerce.number().positive().default(90),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().positive().default(3),
  DRIVER_EARLY_CANCEL_REFUND_PERCENT: z.coerce.number().positive().default(2),
  DRIVER_CANCEL_THRESHOLD_HOURS: z.coerce.number().positive().default(18),

  // Consumed starting Phase 9 (booking seat-hold expiry, claude.md §35/§36).
  // How long a PENDING_PAYMENT booking holds its seat before the BullMQ
  // delayed job releases it.
  BOOKING_PAYMENT_TTL_SECONDS: z.coerce.number().int().positive().default(900),

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

  // Consumed starting Phase 13.5 (AI support chatbot, claude.md §96.5).
  // Gemini is the initial provider (originally speced as Grok — corrected
  // before implementation, claude.md §97 2026-08-16 — since a Gemini API
  // key is what's actually available). GEMINI_API_KEY stays optional: the
  // factory falls back to ConsoleAIProvider for local dev without one, same
  // pattern as Resend/FCM.
  AI_PROVIDER: z.enum(['gemini']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  // An alias, not a pinned version, so a model retirement doesn't break the
  // chatbot (`gemini-2.0-flash` was already retired mid-implementation).
  // The *lite* alias specifically: free-tier quota is per-model-per-day and
  // the flagship alias (`gemini-flash-latest`) carries a very small daily
  // allowance, while a support bot answering FAQs and simple tool lookups
  // doesn't need flagship reasoning. Pin an exact model here if that
  // trade-off ever changes.
  GEMINI_MODEL: z.string().min(1).default('gemini-flash-lite-latest'),

  // claude.md §96.5 cost-control knobs — all configurable rather than
  // hard-coded, per the same reasoning as the fare/business-rule constants
  // above.
  SUPPORT_CHAT_MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(2000),
  SUPPORT_CHAT_MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(20),
  SUPPORT_CHAT_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SUPPORT_CHAT_MAX_TOOL_ROUNDS: z.coerce.number().int().positive().default(2),
  SUPPORT_CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  SUPPORT_CHAT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  SUPPORT_CHAT_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(50),
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
