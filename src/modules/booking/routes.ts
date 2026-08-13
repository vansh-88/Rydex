import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { idParamSchema, validateParams } from '../../app/middleware/validate.js';
import * as bookingController from './controllers/bookingController.js';

// POST /rides/:id/bookings lives on rideRouter (src/modules/ride/routes.ts)
// since claude.md §51 nests booking creation under the ride resource — this
// router only owns the booking-resource-rooted endpoints.
export const bookingRouter = Router();

bookingRouter.use(authenticate);

// Ownership (passenger who booked, or the ride's driver) is enforced in the
// service layer, same reasoning as vehicleRouter/rideRouter — no role gate.
bookingRouter.get('/:id', validateParams(idParamSchema), bookingController.getById);
bookingRouter.post('/:id/cancel', validateParams(idParamSchema), bookingController.cancel);
