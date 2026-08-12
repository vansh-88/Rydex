import type { VehicleType } from '../../../generated/prisma/enums.js';
import type { FareInput, FareResult, FareStrategy } from './fareStrategy.js';

interface MultiplierBounds {
  min: number;
  max: number;
}

export interface HeuristicFareStrategyConfig {
  baseFare: number;
  pricePerKm: number;
  vehicleMultipliers: Record<VehicleType, number>;
  trafficMultiplierBounds: MultiplierBounds;
  ratingMultiplierBounds: MultiplierBounds;
}

const METERS_PER_KM = 1000;
const MIN_RATING = 1;
const MAX_RATING = 5;

function clamp(value: number, bounds: MultiplierBounds): number {
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

// claude.md §29: "driver-rating influence must be bounded so that it cannot
// create unreasonable pricing." A rating of 1 maps to bounds.min, 5 maps to
// bounds.max, linearly in between; no rating yet is neutral (1x, no effect).
function ratingMultiplier(ratingAverage: number | null | undefined, bounds: MultiplierBounds): number {
  if (ratingAverage === null || ratingAverage === undefined) {
    return 1;
  }

  const clampedRating = Math.min(Math.max(ratingAverage, MIN_RATING), MAX_RATING);
  const ratio = (clampedRating - MIN_RATING) / (MAX_RATING - MIN_RATING);
  return bounds.min + ratio * (bounds.max - bounds.min);
}

// claude.md §29: baseFare + (distanceKm * pricePerKm), then bounded
// multipliers for vehicle type / traffic / driver rating.
export class HeuristicFareStrategy implements FareStrategy {
  constructor(private readonly config: HeuristicFareStrategyConfig) {}

  calculate(input: FareInput): FareResult {
    const distanceKm = input.distanceMeters / METERS_PER_KM;
    const distanceComponent = this.config.baseFare + distanceKm * this.config.pricePerKm;

    const vehicleMultiplier = this.config.vehicleMultipliers[input.vehicleType];
    const trafficMultiplier = clamp(input.trafficMultiplier ?? 1, this.config.trafficMultiplierBounds);
    const rating = ratingMultiplier(input.driverRatingAverage, this.config.ratingMultiplierBounds);

    const fare = distanceComponent * vehicleMultiplier * trafficMultiplier * rating;

    return {
      farePerSeat: Math.round(fare),
      currency: 'INR',
    };
  }
}
