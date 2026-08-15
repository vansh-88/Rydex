import type { EmailProvider, SendOtpEmailParams } from './emailProvider.js';

// Dev-only fallback used when BREVO_API_KEY/BREVO_FROM_EMAIL aren't configured,
// so the OTP flow can be exercised end-to-end without a real Brevo account.
// Refused in production by assertProductionSecrets() (claude.md §63) — printing
// OTPs to stdout is a credential disclosure, not just a degraded feature.
export class ConsoleEmailProvider implements EmailProvider {
  sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<void> {
    console.log(`[dev email fallback] OTP for ${to}: ${otp}`);
    return Promise.resolve();
  }
}
