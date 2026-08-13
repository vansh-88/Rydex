import { env } from '../../config/env.js';
import { ConsolePushProvider } from './consolePushProvider.js';
import { FirebasePushProvider } from './firebasePushProvider.js';
import type { PushProvider } from './pushProvider.js';

// Mirrors infrastructure/resend/index.ts and infrastructure/payments/index.ts's
// real-vs-console-fallback pattern, with one addition: unlike Resend/
// Razorpay's constructors (which just store the key and fail lazily on
// first real call), firebase-admin's `cert()` synchronously parses the
// private key and throws immediately if it isn't valid PEM — confirmed by
// actually crashing the whole process at import time with a malformed key.
// A misconfigured push credential must degrade push delivery, not take
// down auth/rides/payments/everything else — so construction is wrapped
// and falls back to the console provider on failure, same as the "not
// configured" case.
function createPushProvider(): PushProvider {
  if (
    env.FCM_PROJECT_ID !== undefined &&
    env.FCM_PROJECT_ID.length > 0 &&
    env.FCM_CLIENT_EMAIL !== undefined &&
    env.FCM_CLIENT_EMAIL.length > 0 &&
    env.FCM_PRIVATE_KEY !== undefined &&
    env.FCM_PRIVATE_KEY.length > 0
  ) {
    try {
      return new FirebasePushProvider(env.FCM_PROJECT_ID, env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    } catch (err) {
      console.error(
        'FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are set but invalid (FirebasePushProvider construction failed) — falling back to ConsolePushProvider. No real push notifications will be sent.',
        err,
      );
      return new ConsolePushProvider();
    }
  }

  console.warn(
    'FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY not set — using ConsolePushProvider. No real push notifications will be sent. See claude.md §42/Phase 12.',
  );
  return new ConsolePushProvider();
}

export const pushProvider: PushProvider = createPushProvider();

export type { PushNotificationPayload, PushProvider, PushSendResult } from './pushProvider.js';
