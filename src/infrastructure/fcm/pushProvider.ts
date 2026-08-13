export interface PushNotificationPayload {
  title: string;
  body: string;
  // FCM data payloads must be flat string maps.
  data?: Record<string, string>;
}

export interface PushSendResult {
  token: string;
  success: boolean;
  // claude.md §45: "when FCM indicates a token is invalid/unregistered,
  // deactivate or remove it" — a per-token outcome, distinct from an
  // overall gateway/auth failure (which throws instead, see below).
  invalidToken: boolean;
}

// claude.md §42/§45: business logic depends only on this interface, never
// directly on the firebase-admin SDK — same Strategy pattern as
// MapProvider/PaymentProvider (§17/§37). `send` resolves per-token
// success/invalid-token outcomes rather than throwing for individual token
// failures (that's normal, expected FCM behavior — stale tokens are
// routine); it only throws for a genuine gateway-level failure (auth,
// network), which the caller lets propagate so BullMQ retries the whole job.
export interface PushProvider {
  send(tokens: string[], payload: PushNotificationPayload): Promise<PushSendResult[]>;
}
