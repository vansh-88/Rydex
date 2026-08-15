import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';

import type { PushNotificationPayload, PushProvider, PushSendResult } from './pushProvider.js';

// FCM's own set of "this token is dead, stop using it" error codes — the
// specific signal claude.md §45 says to act on ("deactivate or remove").
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

// Failures where another attempt could plausibly succeed: the gateway is
// unavailable, we're being throttled, or the credential/authorization is
// broken (fixable by an operator without the message changing). Anything not
// listed is treated as permanent, so a malformed payload doesn't burn five
// retries per notification.
//
// `messaging/invalid-argument` is deliberately absent from BOTH sets. It is
// returned for a malformed registration token *and* for a malformed payload,
// and the two are indistinguishable from the code alone — treating it as an
// invalid token would delete every user's device on a payload bug, and
// treating it as retriable would retry something that can never succeed. It
// is logged instead.
const RETRIABLE_ERROR_CODES = new Set([
  'app/invalid-credential',
  'messaging/authentication-error',
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/unavailable',
  'messaging/quota-exceeded',
  'messaging/message-rate-exceeded',
  'messaging/third-party-auth-error',
]);

export class FirebasePushProvider implements PushProvider {
  private readonly messaging: Messaging;

  constructor(projectId: string, clientEmail: string, privateKey: string) {
    // Env vars commonly carry a PEM key with literal "\n" sequences instead
    // of real newlines — normalize before handing it to the SDK.
    const app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    });
    this.messaging = getMessaging(app);
  }

  async send(tokens: string[], payload: PushNotificationPayload): Promise<PushSendResult[]> {
    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      // `exactOptionalPropertyTypes`: omit the key entirely rather than pass
      // `data: undefined`, which the SDK's types treat differently.
      ...(payload.data ? { data: payload.data } : {}),
    });

    return response.responses.map((result, index) => {
      const errorCode = result.error?.code;

      return {
        token: tokens[index]!,
        success: result.success,
        invalidToken: !result.success && INVALID_TOKEN_ERROR_CODES.has(errorCode ?? ''),
        retriable: !result.success && RETRIABLE_ERROR_CODES.has(errorCode ?? ''),
        ...(errorCode === undefined ? {} : { errorCode }),
      };
    });
  }
}
