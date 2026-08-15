import { AppError } from '../../shared/errors/AppError.js';
import type { EmailProvider, SendOtpEmailParams } from './emailProvider.js';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

// Raw `fetch` rather than the `@getbrevo/brevo` SDK, for the same reason
// GeoapifyMapProvider skips a vendor SDK: this is one plain request/response
// with no intricate protocol to get wrong. Contrast RazorpayProvider (§37) and
// GeminiProvider (§96.5), which use SDKs because signature crypto and the
// tool-calling wire format genuinely are easy to hand-roll incorrectly.
export class BrevoEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  async sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<void> {
    let response: Response;

    try {
      response = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.fromEmail, name: this.fromName },
          to: [{ email: to }],
          subject: 'Your Rydex verification code',
          textContent: `Your Rydex verification code is ${otp}. It expires in a few minutes. If you didn't request this, you can ignore this email.`,
        }),
      });
    } catch (err) {
      // Network-level failure (DNS, TLS, connection reset). The underlying
      // error is attached as `cause` so it stays available to the error
      // handler rather than being discarded by a bare `catch {}`.
      throw new AppError(502, 'EMAIL_SEND_FAILED', 'Failed to reach the email provider', {
        cause: err,
      });
    }

    // The previous Resend implementation awaited the SDK call and ignored its
    // result. That SDK resolves with `{ data, error }` instead of throwing, so
    // every delivery failure — bad key, unverified sender, exhausted quota —
    // was silently discarded and the caller was told the OTP had been sent.
    // Any non-2xx here must surface, whatever the transport.
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AppError(
        502,
        'EMAIL_SEND_FAILED',
        `Email provider rejected the request with status ${response.status}`,
        // Response bodies can echo the recipient address, so the detail rides
        // on `cause` (server-side only, §61) and never on the client message.
        { cause: new Error(detail.slice(0, 500)) },
      );
    }
  }
}
