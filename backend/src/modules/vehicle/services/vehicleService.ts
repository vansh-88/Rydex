import type { VehicleDocumentType } from '../../../generated/prisma/enums.js';
import { documentProvider, toSignedDocumentUrl } from '../../../infrastructure/cloudinary/index.js';
import { getUniqueConstraintFields } from '../../../infrastructure/database/prismaErrors.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as vehicleDocumentRepository from '../repositories/vehicleDocumentRepository.js';
import * as vehicleRepository from '../repositories/vehicleRepository.js';
import type { CreateVehicleInput, UpdateVehicleInput } from '../schemas/vehicleSchemas.js';

export interface VehicleDocumentDto {
  id: string;
  documentType: string;
  status: string;
  documentUrl: string;
  createdAt: Date;
}

export interface VehicleDto {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string | null;
  color: string | null;
  seatCapacity: number;
  vehicleType: string;
  isAc: boolean;
  isAcWorking: boolean | null;
  verificationStatus: string;
  rejectionReason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  documents?: VehicleDocumentDto[];
}

export interface VehicleRecord {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string | null;
  color: string | null;
  seatCapacity: number;
  vehicleType: string;
  isAc: boolean;
  isAcWorking: boolean | null;
  verificationStatus: string;
  rejectionReason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Exported so the Admin module (§96) can render the same document shape
// when reviewing a vehicle, instead of re-deriving it.
export function toDocumentDto(document: {
  id: string;
  documentType: string;
  status: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  createdAt: Date;
}): VehicleDocumentDto {
  return {
    id: document.id,
    documentType: document.documentType,
    status: document.status,
    documentUrl: toSignedDocumentUrl(document.cloudinaryPublicId, document.secureUrl),
    createdAt: document.createdAt,
  };
}

// Exported for the same reason as toDocumentDto above.
export function toVehicleDto(vehicle: VehicleRecord, documents?: VehicleDocumentDto[]): VehicleDto {
  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant,
    color: vehicle.color,
    seatCapacity: vehicle.seatCapacity,
    vehicleType: vehicle.vehicleType,
    isAc: vehicle.isAc,
    isAcWorking: vehicle.isAcWorking,
    verificationStatus: vehicle.verificationStatus,
    rejectionReason: vehicle.rejectionReason,
    status: vehicle.status,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
    ...(documents !== undefined ? { documents } : {}),
  };
}

export async function createVehicle(
  ownerId: string,
  input: CreateVehicleInput,
): Promise<VehicleDto> {
  try {
    const vehicle = await vehicleRepository.create({
      ownerId,
      registrationNumber: input.registrationNumber,
      make: input.make,
      model: input.model,
      variant: input.variant ?? null,
      color: input.color ?? null,
      seatCapacity: input.seatCapacity,
      vehicleType: input.vehicleType,
      isAc: input.isAc,
      isAcWorking: input.isAcWorking ?? null,
    });
    return toVehicleDto(vehicle);
  } catch (err) {
    if (getUniqueConstraintFields(err).includes('registration_number')) {
      throw new AppError(
        409,
        'REGISTRATION_NUMBER_ALREADY_IN_USE',
        'A vehicle with this registration number is already registered',
      );
    }
    throw err;
  }
}

export async function listVehicles(ownerId: string): Promise<VehicleDto[]> {
  const vehicles = await vehicleRepository.findManyByOwner(ownerId);
  return vehicles.map((vehicle) => toVehicleDto(vehicle));
}

// Ownership is enforced here, not via a role check: every vehicle owner is
// already a DRIVER (creation requires it), so returning 404 for "exists but
// not yours" and "doesn't exist" alike avoids leaking other drivers' vehicle
// existence (claude.md §54).
async function getOwnedVehicleOrThrow(ownerId: string, vehicleId: string) {
  const vehicle = await vehicleRepository.findById(vehicleId);

  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  return vehicle;
}

export async function getVehicle(ownerId: string, vehicleId: string): Promise<VehicleDto> {
  const vehicle = await getOwnedVehicleOrThrow(ownerId, vehicleId);
  const documents = vehicle.documents.map(toDocumentDto);
  return toVehicleDto(vehicle, documents);
}

export async function updateVehicle(
  ownerId: string,
  vehicleId: string,
  input: UpdateVehicleInput,
): Promise<VehicleDto> {
  await getOwnedVehicleOrThrow(ownerId, vehicleId);
  const updated = await vehicleRepository.update(vehicleId, input);
  return toVehicleDto(updated);
}

export interface UploadVehicleDocumentInput {
  buffer: Buffer;
}

export async function uploadVehicleDocument(
  ownerId: string,
  vehicleId: string,
  documentType: VehicleDocumentType,
  input: UploadVehicleDocumentInput,
): Promise<VehicleDocumentDto> {
  const vehicle = await getOwnedVehicleOrThrow(ownerId, vehicleId);

  // A rejection is final for this vehicle: the driver registers a different
  // one rather than reworking a vehicle a reviewer has already turned down.
  // Enforced here rather than only in the UI, since the UI cannot be the
  // authority on it — and because vehicleDocumentRepository.create would
  // otherwise quietly move the vehicle back into the review queue.
  if (vehicle.verificationStatus === 'REJECTED') {
    throw new AppError(
      409,
      'VEHICLE_REJECTED',
      'This vehicle was rejected and cannot be resubmitted. Add the vehicle again to have it reviewed.',
    );
  }

  const uploaded = await documentProvider.uploadDocument({
    buffer: input.buffer,
    folder: `vehicles/${vehicleId}`,
  });

  const document = await vehicleDocumentRepository.create({
    vehicleId,
    documentType,
    cloudinaryPublicId: uploaded.publicId,
    secureUrl: uploaded.secureUrl,
  });

  return toDocumentDto(document);
}
