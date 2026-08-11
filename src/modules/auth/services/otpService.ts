import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { redis } from '../../../infrastructure/redis/redisClient.js';

const OTP_HASH_ROUNDS = 10;

const otpRecordSchema = z.object({
  otpHash: z.string(),
  attemptCount: z.number().int().nonnegative(),
  purpose: z.literal('login'),
});

type OtpRecord = z.infer<typeof otpRecordSchema>;

function otpKey(email: string): string {
  return `otp:login:${email}`;
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function createOtp(email: string): Promise<string> {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, OTP_HASH_ROUNDS);
  const record: OtpRecord = { otpHash, attemptCount: 0, purpose: 'login' };

  await redis.set(otpKey(email), JSON.stringify(record), 'EX', env.OTP_TTL_SECONDS);

  return otp;
}

// Throws INVALID_OTP / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS. Resolves (no
// return value) on success and consumes the OTP (single use).
export async function verifyOtp(email: string, candidate: string): Promise<void> {
  const key = otpKey(email);
  const raw = await redis.get(key);

  if (raw === null) {
    throw new AppError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
  }

  const record = otpRecordSchema.parse(JSON.parse(raw));

  if (record.attemptCount >= env.OTP_MAX_ATTEMPTS) {
    await redis.del(key);
    throw new AppError(
      400,
      'OTP_TOO_MANY_ATTEMPTS',
      'Too many incorrect attempts. Request a new code.',
    );
  }

  const isValid = await bcrypt.compare(candidate, record.otpHash);

  if (!isValid) {
    const ttl = await redis.ttl(key);
    const updated: OtpRecord = { ...record, attemptCount: record.attemptCount + 1 };
    await redis.set(key, JSON.stringify(updated), 'EX', ttl > 0 ? ttl : env.OTP_TTL_SECONDS);
    throw new AppError(400, 'INVALID_OTP', 'Incorrect code.');
  }

  await redis.del(key);
}
