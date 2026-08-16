import { apiRequest } from '@/api/client';
import type { Vehicle, VehicleDocument, VehicleDocumentType, VehicleType } from '@/api/types';

export interface CreateVehicleInput {
  registrationNumber: string;
  make: string;
  model: string;
  variant?: string;
  color?: string;
  seatCapacity: number;
  vehicleType: VehicleType;
  isAc: boolean;
}

export function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return apiRequest('/vehicles', { method: 'POST', body: input });
}

export function listVehicles(signal?: AbortSignal): Promise<{ items: Vehicle[] }> {
  return apiRequest('/vehicles', { signal });
}

// Unlike the list, this includes `documents[]` with signed, time-limited URLs.
export function getVehicle(vehicleId: string, signal?: AbortSignal): Promise<Vehicle> {
  return apiRequest(`/vehicles/${vehicleId}`, { signal });
}

export interface UpdateVehicleInput {
  make?: string;
  model?: string;
  variant?: string | null;
  color?: string | null;
  seatCapacity?: number;
  vehicleType?: VehicleType;
  isAc?: boolean;
  isAcWorking?: boolean | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

// registrationNumber is deliberately absent — the backend does not allow it to
// change, since it is the vehicle's identity and is what was verified.
export function updateVehicle(vehicleId: string, input: UpdateVehicleInput): Promise<Vehicle> {
  return apiRequest(`/vehicles/${vehicleId}`, { method: 'PATCH', body: input });
}

export function uploadVehicleDocument(
  vehicleId: string,
  file: File,
  documentType: VehicleDocumentType,
): Promise<VehicleDocument> {
  const formData = new FormData();
  // Field name fixed by the backend's multer config.
  formData.append('document', file);
  formData.append('documentType', documentType);
  return apiRequest(`/vehicles/${vehicleId}/documents`, { method: 'POST', formData });
}
