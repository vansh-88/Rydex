import type { VehicleType } from '../../../generated/prisma/enums.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as vehicleRepository from '../../vehicle/repositories/vehicleRepository.js';

export interface EligibleVehicle {
  id: string;
  vehicleType: VehicleType;
  seatCapacity: number;
}

// claude.md §8/§18/§97 (2026-08-11): the one place ride-creation vehicle
// eligibility is checked — ownership + ACTIVE + VERIFIED + seat capacity.
// Referenced by name in claude.md §96 as "the same eligibility function
// referenced in §8 and §18"; do not duplicate this check elsewhere.
export async function assertVehicleEligibleForRide(
  ownerId: string,
  vehicleId: string,
  requestedSeats: number,
): Promise<EligibleVehicle> {
  const vehicle = await vehicleRepository.findById(vehicleId);

  // Not found and not-owned collapse to the same 404, same reasoning as
  // vehicleService.getOwnedVehicleOrThrow — don't leak another driver's
  // vehicle existence (claude.md §54).
  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  if (vehicle.status !== 'ACTIVE') {
    throw new AppError(409, 'VEHICLE_NOT_ELIGIBLE', 'Vehicle is not active');
  }

  if (vehicle.verificationStatus !== 'VERIFIED') {
    throw new AppError(409, 'VEHICLE_NOT_ELIGIBLE', 'Vehicle is not admin-verified');
  }

  if (vehicle.seatCapacity < requestedSeats) {
    throw new AppError(
      409,
      'VEHICLE_NOT_ELIGIBLE',
      `Vehicle seat capacity (${vehicle.seatCapacity}) is less than requested seats (${requestedSeats})`,
    );
  }

  return { id: vehicle.id, vehicleType: vehicle.vehicleType, seatCapacity: vehicle.seatCapacity };
}
