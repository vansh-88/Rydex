import { env } from '../../config/env.js';
import { ConsoleEmailProvider } from './consoleEmailProvider.js';
import type { EmailProvider } from './emailProvider.js';
import { ResendEmailProvider } from './resendEmailProvider.js';

function createEmailProvider(): EmailProvider {
  if (
    env.RESEND_API_KEY !== undefined &&
    env.RESEND_API_KEY.length > 0 &&
    env.RESEND_FROM_EMAIL !== undefined
  ) {
    return new ResendEmailProvider(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  }

  console.warn(
    'RESEND_API_KEY/RESEND_FROM_EMAIL not set — using the console email provider. OTPs will be logged, not emailed. Do not run this in production.',
  );
  return new ConsoleEmailProvider();
}

export const emailProvider: EmailProvider = createEmailProvider();
