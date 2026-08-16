import { env } from '../../../config/env.js';
import { HeuristicFareStrategy } from '../strategies/heuristicFareStrategy.js';
import type { FareInput, FareResult, FareStrategy } from '../strategies/fareStrategy.js';

const defaultStrategy: FareStrategy = new HeuristicFareStrategy({
  baseFare: env.FARE_BASE_FARE,
  pricePerKm: env.FARE_PRICE_PER_KM,
  vehicleMultipliers: {
    HATCHBACK: env.FARE_VEHICLE_MULTIPLIER_HATCHBACK,
    SEDAN: env.FARE_VEHICLE_MULTIPLIER_SEDAN,
    SUV: env.FARE_VEHICLE_MULTIPLIER_SUV,
    MUV: env.FARE_VEHICLE_MULTIPLIER_MUV,
  },
  trafficMultiplierBounds: { min: env.FARE_TRAFFIC_MULTIPLIER_MIN, max: env.FARE_TRAFFIC_MULTIPLIER_MAX },
  ratingMultiplierBounds: { min: env.FARE_RATING_MULTIPLIER_MIN, max: env.FARE_RATING_MULTIPLIER_MAX },
});

// claude.md §28: ride creation calls this, never a concrete FareStrategy.
// `strategy` is overridable for tests; production call sites always get the
// configured HeuristicFareStrategy by omitting it.
export function calculateFare(input: FareInput, strategy: FareStrategy = defaultStrategy): FareResult {
  return strategy.calculate(input);
}
