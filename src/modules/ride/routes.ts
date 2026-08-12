import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import { validateBody, validateQuery } from '../../app/middleware/validate.js';
import * as bookingController from '../booking/controllers/bookingController.js';
import { createBookingSchema } from '../booking/schemas/bookingSchemas.js';
import * as rideController from './controllers/rideController.js';
import { searchRidesQuerySchema } from './schemas/rideSearchSchemas.js';
import { createRideSchema } from './schemas/rideSchemas.js';

export const rideRouter = Router();

rideRouter.use(authenticate);

// claude.md §8: only a DRIVER may create a ride. Cancel/start/complete are
// scoped by ownership in the service layer instead (same reasoning as
// vehicleRouter: every ride's driver is already a DRIVER by construction),
// so no extra role check is needed there.
rideRouter.post('/', authorize('DRIVER'), validateBody(createRideSchema), rideController.create);

// Must be registered before GET /:id — otherwise Express would match
// "search" as the :id param.
rideRouter.get('/search', validateQuery(searchRidesQuerySchema), rideController.search);

// Any authenticated user (driver or passenger) can view ride details —
// passengers need this before booking (Phase 9).
rideRouter.get('/:id', rideController.getById);

rideRouter.post('/:id/cancel', rideController.cancel);
rideRouter.post('/:id/start', rideController.start);
rideRouter.post('/:id/complete', rideController.complete);

// claude.md §51: booking creation is nested under the ride resource. The
// booking module owns the actual logic (services/repositories/controller);
// this is routing wiring only, same pattern as admin/routes.ts already
// composing other modules' functions.
rideRouter.post('/:id/bookings', validateBody(createBookingSchema), bookingController.create);
