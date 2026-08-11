import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import { validateBody } from '../../app/middleware/validate.js';
import * as adminDriverApplicationController from './controllers/adminDriverApplicationController.js';
import { rejectDriverApplicationSchema } from './schemas/driverApplicationSchemas.js';

export const adminRouter = Router();

// claude.md §96: every admin route requires ADMIN — never reachable by
// DRIVER/PASSENGER.
adminRouter.use(authenticate, authorize('ADMIN'));

adminRouter.get('/driver-applications', adminDriverApplicationController.list);

adminRouter.post(
  '/driver-applications/:userId/verify',
  adminDriverApplicationController.verify,
);

adminRouter.post(
  '/driver-applications/:userId/reject',
  validateBody(rejectDriverApplicationSchema),
  adminDriverApplicationController.reject,
);
