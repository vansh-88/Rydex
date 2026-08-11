import { Prisma } from '../../../generated/prisma/client.js';
import { getUniqueConstraintFields } from '../../../infrastructure/database/prismaErrors.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../repositories/userRepository.js';
import type { UpdateProfileInput } from '../schemas/userSchemas.js';

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  name: string;
  profileImageUrl: string | null;
  role: string;
  status: string;
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function toUserProfile(user: {
  id: string;
  email: string;
  phone: string;
  name: string;
  profileImageUrl: string | null;
  role: string;
  status: string;
  ratingAverage: Prisma.Decimal | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    ratingAverage: user.ratingAverage === null ? null : user.ratingAverage.toNumber(),
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function uniqueViolationField(err: unknown): 'email' | 'phone' | null {
  const fields = getUniqueConstraintFields(err);

  if (fields.includes('email')) return 'email';
  if (fields.includes('phone')) return 'phone';
  return null;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toUserProfile(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  try {
    const user = await userRepository.updateProfile(userId, input);
    return toUserProfile(user);
  } catch (err) {
    const field = uniqueViolationField(err);

    if (field === 'email') {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'This email is already registered');
    }
    if (field === 'phone') {
      throw new AppError(409, 'PHONE_ALREADY_IN_USE', 'This phone number is already registered');
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    throw err;
  }
}
