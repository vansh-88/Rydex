import { apiRequest, withQuery } from '@/api/client';
import type { PendingDriverApplication, VehicleReview } from '@/api/types';

// Every route here is gated by authorize('ADMIN') on the backend — the only
// place in the API that uses a role check rather than an ownership check.

export function listDriverApplications(
  signal?: AbortSignal,
): Promise<{ items: PendingDriverApplication[] }> {
  // PENDING is the only status the backend accepts; anything else is a 400.
  return apiRequest(withQuery('/admin/driver-applications', { status: 'PENDING' }), { signal });
}

export function verifyDriverApplication(userId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/driver-applications/${userId}/verify`, { method: 'POST' });
}

export function rejectDriverApplication(
  userId: string,
  rejectionReason: string,
): Promise<{ message: string }> {
  return apiRequest(`/admin/driver-applications/${userId}/reject`, {
    method: 'POST',
    body: { rejectionReason },
  });
}

export function listPendingVehicles(signal?: AbortSignal): Promise<{ items: VehicleReview[] }> {
  return apiRequest(withQuery('/admin/vehicles', { status: 'PENDING' }), { signal });
}

export function getVehicleReview(vehicleId: string, signal?: AbortSignal): Promise<VehicleReview> {
  return apiRequest(`/admin/vehicles/${vehicleId}`, { signal });
}

export function verifyVehicle(vehicleId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/vehicles/${vehicleId}/verify`, { method: 'POST' });
}

export function rejectVehicle(
  vehicleId: string,
  rejectionReason: string,
): Promise<{ message: string }> {
  return apiRequest(`/admin/vehicles/${vehicleId}/reject`, {
    method: 'POST',
    body: { rejectionReason },
  });
}
