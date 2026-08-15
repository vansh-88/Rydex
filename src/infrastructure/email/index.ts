import { env } from '../../config/env.js';
import { BrevoEmailProvider } from './brevoEmailProvider.js';
import { ConsoleEmailProvider } from './consoleEmailProvider.js';
import type { EmailProvider } from './emailProvider.js';

// Factory keyed off config, mirroring infrastructure/maps|payments|ai|fcm.
// The directory is named for the capability rather than the vendor: swapping
// Resend for Brevo (claude.md §97, 2026-08-14) touched only this folder, which
// is exactly what the EmailProvider seam exists to make cheap.
function createEmailProvider(): EmailProvider {
  if (
    env.BREVO_API_KEY !== undefined &&
    env.BREVO_API_KEY.length > 0 &&
    env.BREVO_FROM_EMAIL !== undefined &&
    env.BREVO_FROM_EMAIL.length > 0
  ) {
    return new BrevoEmailProvider(env.BREVO_API_KEY, env.BREVO_FROM_EMAIL, env.BREVO_FROM_NAME);
  }

  console.warn(
    'BREVO_API_KEY/BREVO_FROM_EMAIL not set — using the console email provider. OTPs will be logged, not emailed. Refused in production.',
  );
  return new ConsoleEmailProvider();
}

export const emailProvider: EmailProvider = createEmailProvider();

export type { EmailProvider, SendOtpEmailParams } from './emailProvider.js';
