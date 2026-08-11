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

// New signups always land as PASSENGER (claude.md doesn't yet define a
// driver-upgrade flow — see steps.md Phase 3 note). ADMIN is never created
// through this path (claude.md §96: seed script / manual DB insert only).
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
