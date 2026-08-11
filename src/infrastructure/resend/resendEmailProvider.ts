import { Resend } from 'resend';

import type { EmailProvider, SendOtpEmailParams } from './emailProvider.js';

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.client = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<void> {
    await this.client.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Your Rydex verification code',
      text: `Your Rydex verification code is ${otp}. It expires in a few minutes. If you didn't request this, you can ignore this email.`,
    });
  }
}
