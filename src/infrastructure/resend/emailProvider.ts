export interface SendOtpEmailParams {
  to: string;
  otp: string;
}

export interface EmailProvider {
  sendOtpEmail(params: SendOtpEmailParams): Promise<void>;
}
