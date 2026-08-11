import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export interface CreatePassengerInput {
  email: string;
  name: string;
  phone: string;
}

// New signups always land as PASSENGER — becoming a DRIVER only happens
// through the driver-license verification flow below (claude.md §8/§96).
// ADMIN is never created through this path (claude.md §96: seed script /
// manual DB insert only).
export function createPassenger(input: CreatePassengerInput) {
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: 'PASSENGER',
      status: 'ACTIVE',
    },
  });
}

export interface UpdateProfileInput {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  profileImageUrl?: string | null | undefined;
}

// Only profile fields land here — role/status/rating are server-controlled
// and must never be reachable through this function (claude.md §53, steps.md
// Phase 4).
export function updateProfile(id: string, data: UpdateProfileInput) {
  // exactOptionalPropertyTypes rejects `undefined` values on Prisma's input
  // types, so omitted (rather than explicitly-undefined) keys are required.
  const update: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.email !== undefined) update.email = data.email;
  if (data.profileImageUrl !== undefined) update.profileImageUrl = data.profileImageUrl;

  return prisma.user.update({ where: { id }, data: update });
}

export interface SubmitDriverApplicationInput {
  cloudinaryPublicId: string;
  secureUrl: string;
}

// claude.md §8/§96: creating the UserDocument and moving the applicant to
// PENDING happen together — a resubmission after rejection also clears the
// previous decision fields so the application reads as fresh.
export function submitDriverApplication(userId: string, doc: SubmitDriverApplicationInput) {
  return prisma.$transaction(async (tx) => {
    await tx.userDocument.create({
      data: {
        userId,
        documentType: 'DRIVING_LICENSE',
        cloudinaryPublicId: doc.cloudinaryPublicId,
        secureUrl: doc.secureUrl,
      },
    });

    return tx.user.update({
      where: { id: userId },
      data: {
        driverLicenseStatus: 'PENDING',
        driverLicenseVerifiedById: null,
        driverLicenseVerifiedAt: null,
        driverLicenseRejectionReason: null,
      },
    });
  });
}

export function findPendingDriverApplications() {
  return prisma.user.findMany({
    where: { driverLicenseStatus: 'PENDING' },
    orderBy: { updatedAt: 'asc' },
  });
}

// Conditional update (WHERE ... AND driverLicenseStatus = 'PENDING') instead
// of a separate SELECT-then-UPDATE: two concurrent admin decisions on the
// same application can't both apply (claude.md §58). The boolean return
// tells the caller whether the transition actually happened, so it can
// distinguish "not found" from "not pending" without a second lock.
export async function verifyDriverApplication(userId: string, adminId: string): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id: userId, driverLicenseStatus: 'PENDING' },
    data: {
      role: 'DRIVER',
      driverLicenseStatus: 'VERIFIED',
      driverLicenseVerifiedById: adminId,
      driverLicenseVerifiedAt: new Date(),
      driverLicenseRejectionReason: null,
    },
  });

  return result.count === 1;
}

export async function rejectDriverApplication(
  userId: string,
  adminId: string,
  rejectionReason: string,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id: userId, driverLicenseStatus: 'PENDING' },
    data: {
      driverLicenseStatus: 'REJECTED',
      driverLicenseVerifiedById: adminId,
      driverLicenseVerifiedAt: new Date(),
      driverLicenseRejectionReason: rejectionReason,
    },
  });

  return result.count === 1;
}
