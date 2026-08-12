import type { VehicleType } from '../../../generated/prisma/enums.js';

export interface FareInput {
  distanceMeters: number;
  vehicleType: VehicleType;
  // Defaults to 1 (no adjustment) when omitted.
  trafficMultiplier?: number;
  // null/omitted means "driver has no rating yet" — treated as neutral (1x).
  driverRatingAverage?: number | null;
}

export interface FareResult {
  farePerSeat: number;
  currency: 'INR';
}

// claude.md §28: FareService depends on this interface, never on a concrete
// strategy directly. HeuristicFareStrategy is the only implementation today;
// AIFareStrategy (§28) can be added later without touching call sites.
export interface FareStrategy {
  calculate(input: FareInput): FareResult;
}
