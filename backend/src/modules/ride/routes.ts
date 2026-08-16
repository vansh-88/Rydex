import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import { idempotency } from '../../app/middleware/idempotency.js';
import { authenticatedReadLimit } from '../../app/middleware/rateLimits.js';
import {
  idParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../../app/middleware/validate.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../infrastructure/redis/rateLimit.js';
import * as bookingController from '../booking/controllers/bookingController.js';
import { createBookingSchema } from '../booking/schemas/bookingSchemas.js';
import * as rideController from './controllers/rideController.js';
import { searchRidesQuerySchema } from './schemas/rideSearchSchemas.js';
import { createRideSchema, listMyRidesQuerySchema } from './schemas/rideSchemas.js';

export const rideRouter = Router();

rideRouter.use(authenticate);

// claude.md §49/§50: the three endpoints here that cost something real get
// their own limits. Search runs a PostGIS spatial query; ride creation calls
// Geoapify *and* Razorpay; booking creation holds a real seat for
// BOOKING_PAYMENT_TTL_SECONDS. All keyed per user — every route on this
// router is behind `authenticate`, so a user id is always available and is a
// far better key than an IP shared by a whole mobile carrier.
const searchLimit = rateLimit({
  keyPrefix: 'ride-search-user',
  windowSeconds: env.RIDE_SEARCH_RATE_LIMIT_WINDOW_SECONDS,
  max: env.RIDE_SEARCH_RATE_LIMIT_MAX,
  keyFn: (req) => req.user!.id,
});

const createRideLimit = rateLimit({
  keyPrefix: 'ride-create-user',
  windowSeconds: env.RIDE_CREATE_RATE_LIMIT_WINDOW_SECONDS,
  max: env.RIDE_CREATE_RATE_LIMIT_MAX,
  keyFn: (req) => req.user!.id,
});

const createBookingLimit = rateLimit({
  keyPrefix: 'booking-create-user',
  windowSeconds: env.BOOKING_CREATE_RATE_LIMIT_WINDOW_SECONDS,
  max: env.BOOKING_CREATE_RATE_LIMIT_MAX,
  keyFn: (req) => req.user!.id,
});

// claude.md §8: only a DRIVER may create a ride. Cancel/start/complete are
// scoped by ownership in the service layer instead (same reasoning as
// vehicleRouter: every ride's driver is already a DRIVER by construction),
// so no extra role check is needed there. claude.md §39: idempotency runs
// after validation — a request that fails validation had no side effect, so
// it doesn't need a claimed key.
// Rate limit sits ahead of validation and idempotency on purpose: a request
// that is going to be rejected should consume as little work as possible,
// and idempotency costs a database round trip to claim the key.
rideRouter.post(
  '/',
  authorize('DRIVER'),
  createRideLimit,
  validateBody(createRideSchema),
  idempotency('POST /rides'),
  rideController.create,
);

// Must be registered before GET /:id — otherwise Express would match
// "search" as the :id param.
rideRouter.get(
  '/search',
  searchLimit,
  validateQuery(searchRidesQuerySchema),
  rideController.search,
);

// The driver half of "My Trips" (the passenger half is GET /bookings).
// Registered before GET /:id for the same reason /search is — Express would
// otherwise match "mine" as the :id param. DRIVER-gated because a PASSENGER
// has no rides by construction, so the honest response is 403 rather than an
// empty list that implies the feature might one day fill up.
rideRouter.get(
  '/mine',
  authorize('DRIVER'),
  authenticatedReadLimit,
  validateQuery(listMyRidesQuerySchema),
  rideController.listMine,
);

// Any authenticated user (driver or passenger) can view ride details —
// passengers need this before booking (Phase 9).
rideRouter.get('/:id', validateParams(idParamSchema), rideController.getById);

// The driver's passenger list for one ride. Ownership is enforced in
// bookingService.listRideBookings (404 for anyone else, including this
// ride's own passengers), so no role gate is needed here — same arrangement
// as cancel/start/complete below. The booking module owns the logic; this is
// routing wiring only, mirroring POST /:id/bookings.
rideRouter.get(
  '/:id/bookings',
  authenticatedReadLimit,
  validateParams(idParamSchema),
  bookingController.listForRide,
);

rideRouter.post('/:id/cancel', validateParams(idParamSchema), rideController.cancel);
rideRouter.post('/:id/start', validateParams(idParamSchema), rideController.start);
rideRouter.post('/:id/complete', validateParams(idParamSchema), rideController.complete);

// claude.md §51: booking creation is nested under the ride resource. The
// booking module owns the actual logic (services/repositories/controller);
// this is routing wiring only, same pattern as admin/routes.ts already
// composing other modules' functions.
rideRouter.post(
  '/:id/bookings',
  createBookingLimit,
  validateParams(idParamSchema),
  validateBody(createBookingSchema),
  idempotency('POST /rides/:id/bookings'),
  bookingController.create,
);
