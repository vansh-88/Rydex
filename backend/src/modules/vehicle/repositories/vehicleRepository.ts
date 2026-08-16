import type { Prisma } from '../../../generated/prisma/client.js';
import type { VehicleType } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

export interface CreateVehicleInput {
  ownerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string | null;
  color: string | null;
  seatCapacity: number;
  vehicleType: VehicleType;
  isAc: boolean;
  isAcWorking: boolean | null;
}

export function create(input: CreateVehicleInput) {
  return prisma.vehicle.create({ data: input });
}

export function findById(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: { documents: true },
  });
}

export function findManyByOwner(ownerId: string) {
  return prisma.vehicle.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
}

// claude.md §96: admin review needs the owner's contact details alongside
// the vehicle, plus its documents to actually inspect.
export function findPendingWithOwnerAndDocuments() {
  return prisma.vehicle.findMany({
    where: { verificationStatus: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { owner: true, documents: true },
  });
}

// Same conditional-update pattern as the driver-license flow (§58): the
// WHERE clause double-checks verificationStatus = 'PENDING' atomically, so
// two concurrent admin decisions on the same vehicle can't both apply.
export async function verifyVehicle(vehicleId: string, adminId: string): Promise<boolean> {
  const result = await prisma.vehicle.updateMany({
    where: { id: vehicleId, verificationStatus: 'PENDING' },
    data: {
      verificationStatus: 'VERIFIED',
      verifiedById: adminId,
      verifiedAt: new Date(),
      rejectionReason: null,
    },
  });

  return result.count === 1;
}

export async function rejectVehicle(
  vehicleId: string,
  adminId: string,
  rejectionReason: string,
): Promise<boolean> {
  const result = await prisma.vehicle.updateMany({
    where: { id: vehicleId, verificationStatus: 'PENDING' },
    data: {
      verificationStatus: 'REJECTED',
      verifiedById: adminId,
      verifiedAt: new Date(),
      rejectionReason,
    },
  });

  return result.count === 1;
}

export interface UpdateVehicleInput {
  make?: string | undefined;
  model?: string | undefined;
  variant?: string | null | undefined;
  color?: string | null | undefined;
  seatCapacity?: number | undefined;
  vehicleType?: VehicleType | undefined;
  isAc?: boolean | undefined;
  isAcWorking?: boolean | null | undefined;
  status?: 'ACTIVE' | 'INACTIVE' | undefined;
}

// Only owner-editable fields land here — registrationNumber (immutable) and
// verificationStatus/verifiedBy/verifiedAt/rejectionReason (admin-only, §96)
// must never be reachable through this function.
export function update(id: string, data: UpdateVehicleInput) {
  const update: Prisma.VehicleUpdateInput = {};
  if (data.make !== undefined) update.make = data.make;
  if (data.model !== undefined) update.model = data.model;
  if (data.variant !== undefined) update.variant = data.variant;
  if (data.color !== undefined) update.color = data.color;
  if (data.seatCapacity !== undefined) update.seatCapacity = data.seatCapacity;
  if (data.vehicleType !== undefined) update.vehicleType = data.vehicleType;
  if (data.isAc !== undefined) update.isAc = data.isAc;
  if (data.isAcWorking !== undefined) update.isAcWorking = data.isAcWorking;
  if (data.status !== undefined) update.status = data.status;

  return prisma.vehicle.update({ where: { id }, data: update });
}
