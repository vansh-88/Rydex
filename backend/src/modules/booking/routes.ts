import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authenticatedReadLimit } from '../../app/middleware/rateLimits.js';
import {
  idParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../../app/middleware/validate.js';
import * as ratingController from '../rating/controllers/ratingController.js';
import { submitRatingSchema } from '../rating/schemas/ratingSchemas.js';
import * as bookingController from './controllers/bookingController.js';
import { listBookingsQuerySchema } from './schemas/bookingSchemas.js';

// POST /rides/:id/bookings lives on rideRouter (src/modules/ride/routes.ts)
// since claude.md §51 nests booking creation under the ride resource — this
// router only owns the booking-resource-rooted endpoints.
export const bookingRouter = Router();

bookingRouter.use(authenticate);

// Ownership (passenger who booked, or the ride's driver) is enforced in the
// service layer, same reasoning as vehicleRouter/rideRouter — no role gate.
// The caller's own bookings, scoped by the access token — this is the
// passenger half of "My Trips" (the driver half is GET /rides/mine).
// Registered before /:id for the same reason /rides/search is: Express would
// otherwise never reach a sibling literal path.
bookingRouter.get(
  '/',
  authenticatedReadLimit,
  validateQuery(listBookingsQuerySchema),
  bookingController.list,
);

bookingRouter.get('/:id', validateParams(idParamSchema), bookingController.getById);
bookingRouter.post('/:id/cancel', validateParams(idParamSchema), bookingController.cancel);

// Ratings are rooted at the booking because a booking is exactly the unit two
// people shared a trip through — which is what makes "one rating per
// participant per trip" expressible as a unique constraint. The rating module
// owns the logic; this is routing wiring only, the same arrangement rideRouter
// already uses for booking creation.
//
// Which direction a rating goes (passenger→driver or driver→passenger) is
// derived from the authenticated caller in ratingService, never sent by the
// client — so one endpoint serves both.
bookingRouter.post(
  '/:id/ratings',
  authenticatedReadLimit,
  validateParams(idParamSchema),
  validateBody(submitRatingSchema),
  ratingController.submit,
);
bookingRouter.get(
  '/:id/ratings',
  authenticatedReadLimit,
  validateParams(idParamSchema),
  ratingController.list,
);
