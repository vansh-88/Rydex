import { prisma } from '../../../infrastructure/database/prismaClient.js';

export function findLatestDrivingLicense(userId: string) {
  return prisma.userDocument.findFirst({
    where: { userId, documentType: 'DRIVING_LICENSE' },
    orderBy: { createdAt: 'desc' },
  });
}
