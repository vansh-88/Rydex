import type { EmailProvider, SendOtpEmailParams } from './emailProvider.js';

// Dev-only fallback used when RESEND_API_KEY isn't configured, so the OTP
// flow can be exercised end-to-end without a real Resend account.
export class ConsoleEmailProvider implements EmailProvider {
  sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<void> {
    console.log(`[dev email fallback] OTP for ${to}: ${otp}`);
    return Promise.resolve();
  }
}
