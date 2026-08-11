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
