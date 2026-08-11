import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../../user/repositories/userRepository.js';
import * as vehicleRepository from '../../vehicle/repositories/vehicleRepository.js';
import { toDocumentDto, toVehicleDto } from '../../vehicle/services/vehicleService.js';
import type { VehicleDto } from '../../vehicle/services/vehicleService.js';

export interface VehicleOwnerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface VehicleReview {
  owner: VehicleOwnerSummary;
  vehicle: VehicleDto;
}

function toOwnerSummary(owner: { id: string; name: string; email: string; phone: string }) {
  return { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone };
}

export async function listPendingVehicles(): Promise<VehicleReview[]> {
  const vehicles = await vehicleRepository.findPendingWithOwnerAndDocuments();

  return vehicles.map((vehicle) => ({
    owner: toOwnerSummary(vehicle.owner),
    vehicle: toVehicleDto(vehicle, vehicle.documents.map(toDocumentDto)),
  }));
}

export async function getVehicleById(vehicleId: string): Promise<VehicleReview> {
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) {
    throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  const owner = await userRepository.findById(vehicle.ownerId);
  if (!owner) {
    throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  return {
    owner: toOwnerSummary(owner),
    vehicle: toVehicleDto(vehicle, vehicle.documents.map(toDocumentDto)),
  };
}

async function assertVehicleExists(vehicleId: string): Promise<void> {
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) {
    throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  }
}

export async function verifyVehicle(adminId: string, vehicleId: string): Promise<void> {
  await assertVehicleExists(vehicleId);

  const applied = await vehicleRepository.verifyVehicle(vehicleId, adminId);
  if (!applied) {
    throw new AppError(409, 'VEHICLE_NOT_PENDING', 'This vehicle is not pending review');
  }
}

export async function rejectVehicle(
  adminId: string,
  vehicleId: string,
  rejectionReason: string,
): Promise<void> {
  await assertVehicleExists(vehicleId);

  const applied = await vehicleRepository.rejectVehicle(vehicleId, adminId, rejectionReason);
  if (!applied) {
    throw new AppError(409, 'VEHICLE_NOT_PENDING', 'This vehicle is not pending review');
  }
}
