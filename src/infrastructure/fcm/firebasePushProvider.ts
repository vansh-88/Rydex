import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';

import type { PushNotificationPayload, PushProvider, PushSendResult } from './pushProvider.js';

// FCM's own set of "this token is dead, stop using it" error codes — the
// specific signal claude.md §45 says to act on ("deactivate or remove").
// Every other error on a given token is a transient/unknown failure, left
// alone rather than guessed at.
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
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

    return response.responses.map((result, index) => ({
      token: tokens[index]!,
      success: result.success,
      invalidToken: !result.success && INVALID_TOKEN_ERROR_CODES.has(result.error?.code ?? ''),
    }));
  }
}
