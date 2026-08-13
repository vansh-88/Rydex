import type { PushNotificationPayload, PushProvider, PushSendResult } from './pushProvider.js';

// Dev-only fallback used when FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY aren't
// configured — same role as ConsoleEmailProvider/StubPaymentProvider. Never
// reports a token as invalid (there's no real gateway to say so), so
// userDeviceRepository cleanup never fires in this mode.
export class ConsolePushProvider implements PushProvider {
  send(tokens: string[], payload: PushNotificationPayload): Promise<PushSendResult[]> {
    console.log(`[dev push fallback] "${payload.title}" — ${payload.body} -> [${tokens.join(', ')}]`);
    return Promise.resolve(tokens.map((token) => ({ token, success: true, invalidToken: false })));
  }
}
