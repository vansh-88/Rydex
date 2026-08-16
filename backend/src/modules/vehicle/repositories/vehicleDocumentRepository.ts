import type { VehicleDocumentType } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateVehicleDocumentInput {
  vehicleId: string;
  documentType: VehicleDocumentType;
  cloudinaryPublicId: string;
  secureUrl: string;
}

export function create(input: CreateVehicleDocumentInput) {
  return prisma.vehicleDocument.create({ data: input });
}
