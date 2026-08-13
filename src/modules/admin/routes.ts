import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import {
  idParamSchema,
  userIdParamSchema,
  validateBody,
  validateParams,
} from '../../app/middleware/validate.js';
import * as adminDriverApplicationController from './controllers/adminDriverApplicationController.js';
import * as adminVehicleController from './controllers/adminVehicleController.js';
import { rejectDriverApplicationSchema } from './schemas/driverApplicationSchemas.js';
import { rejectVehicleSchema } from './schemas/vehicleSchemas.js';

export const adminRouter = Router();

// claude.md §96: every admin route requires ADMIN — never reachable by
// DRIVER/PASSENGER.
adminRouter.use(authenticate, authorize('ADMIN'));

adminRouter.get('/driver-applications', adminDriverApplicationController.list);

adminRouter.post(
  '/driver-applications/:userId/verify',
  validateParams(userIdParamSchema),
  adminDriverApplicationController.verify,
);

adminRouter.post(
  '/driver-applications/:userId/reject',
  validateParams(userIdParamSchema),
  validateBody(rejectDriverApplicationSchema),
  adminDriverApplicationController.reject,
);

adminRouter.get('/vehicles', adminVehicleController.list);

adminRouter.get('/vehicles/:id', validateParams(idParamSchema), adminVehicleController.getById);

adminRouter.post('/vehicles/:id/verify', validateParams(idParamSchema), adminVehicleController.verify);

adminRouter.post(
  '/vehicles/:id/reject',
  validateParams(idParamSchema),
  validateBody(rejectVehicleSchema),
  adminVehicleController.reject,
);
