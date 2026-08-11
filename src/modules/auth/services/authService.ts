import { getUniqueConstraintFields } from '../../../infrastructure/database/prismaErrors.js';
import { emailProvider } from '../../../infrastructure/resend/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../../user/repositories/userRepository.js';
import * as otpService from './otpService.js';
import * as tokenService from './tokenService.js';

export async function requestOtp(email: string): Promise<void> {
  const otp = await otpService.createOtp(email);
  await emailProvider.sendOtpEmail({ to: email, otp });
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
  name?: string | undefined;
  phone?: string | undefined;
  deviceId?: string | undefined;
}

export interface AuthenticatedSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: string;
    status: string;
  };
}

function isUniquePhoneViolation(err: unknown): boolean {
  return getUniqueConstraintFields(err).includes('phone');
}

export async function verifyOtpAndAuthenticate(
  input: VerifyOtpInput,
): Promise<AuthenticatedSession> {
  let user = await userRepository.findByEmail(input.email);
  const { name, phone } = input;

  // Checked before the OTP is consumed: a request that can't succeed
  // anyway shouldn't burn the (single-use) code, forcing a fresh
  // request-otp round trip just because name/phone were left out.
  if (!user && (name === undefined || phone === undefined)) {
    throw new AppError(
      400,
      'SIGNUP_DETAILS_REQUIRED',
      'name and phone are required to create a new account',
    );
  }

  await otpService.verifyOtp(input.email, input.otp);

  if (!user) {
    try {
      user = await userRepository.createPassenger({
        email: input.email,
        // Guaranteed defined by the guard above (throws otherwise).
        name: name as string,
        phone: phone as string,
      });
    } catch (err) {
      if (isUniquePhoneViolation(err)) {
        throw new AppError(409, 'PHONE_ALREADY_IN_USE', 'This phone number is already registered');
      }
      throw err;
    }
  }

  const accessToken = tokenService.signAccessToken(user.id, user.role);
  const refreshToken = await tokenService.issueRefreshToken(user.id, input.deviceId);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}

export async function refreshSession(refreshToken: string): Promise<tokenService.RotatedSession> {
  return tokenService.rotateRefreshToken(refreshToken);
}

export async function logout(refreshToken: string, allDevices: boolean): Promise<void> {
  const revoked = await tokenService.revokeRefreshToken(refreshToken);

  if (allDevices && revoked !== null) {
    await tokenService.revokeAllRefreshTokens(revoked.userId);
  }
}
