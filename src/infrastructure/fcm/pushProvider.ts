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
  // overall gateway/auth failure.
  invalidToken: boolean;
  // True when the failure is plausibly transient or systemic (gateway down,
  // quota, bad credentials) and so worth another BullMQ attempt. False for
  // permanent per-message failures, where retrying just burns attempts.
  //
  // This exists because the original contract assumed gateway-level failures
  // would throw. They don't: firebase-admin reports even
  // `app/invalid-credential` as a per-token result, so a completely broken
  // credential looked identical to a routine stale token and every push
  // failed silently. Classification stays here in the provider, where the
  // vendor's error vocabulary belongs — the same reasoning that put
  // `verifyWebhookSignature` behind PaymentProvider (§37).
  retriable: boolean;
  // Vendor error code, for logs only. Never surfaced to a client.
  errorCode?: string;
}

// claude.md §42/§45: business logic depends only on this interface, never
// directly on the firebase-admin SDK — same Strategy pattern as
// MapProvider/PaymentProvider (§17/§37). `send` resolves per-token outcomes
// rather than throwing for individual token failures (stale tokens are
// routine); the caller decides what to do with them via `invalidToken` and
// `retriable`. It may still throw if the SDK call itself fails outright.
export interface PushProvider {
  send(tokens: string[], payload: PushNotificationPayload): Promise<PushSendResult[]>;
}
