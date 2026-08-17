import type { VehicleDocumentType } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateVehicleDocumentInput {
  vehicleId: string;
  documentType: VehicleDocumentType;
  cloudinaryPublicId: string;
  secureUrl: string;
}

// Adding a document is a re-submission for review, so it must move the vehicle
// back to PENDING and clear the previous decision — mirroring
// userRepository.submitDriverApplication, which already does exactly this for
// a driving licence.
//
// Without this, a document uploaded onto an already-decided vehicle was
// invisible to the reviewer forever: the admin queue lists only
// `verificationStatus: 'PENDING'`, so a VERIFIED vehicle's new RC never
// appeared, and a REJECTED vehicle could never be corrected — leaving the
// driver permanently stuck behind a "Replace" control that silently did
// nothing.
//
// Both writes are one transaction: a document that exists while the vehicle
// still claims to be decided is the inconsistent state this is fixing.
export function create(input: CreateVehicleDocumentInput) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.vehicleDocument.create({ data: input });

    await tx.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        verificationStatus: 'PENDING',
        verifiedById: null,
        verifiedAt: null,
        rejectionReason: null,
      },
    });

    return document;
  });
}
