import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import { uploadDocument, validateDocumentFile } from '../../app/middleware/uploadDocument.js';
import { validateBody } from '../../app/middleware/validate.js';
import * as vehicleController from './controllers/vehicleController.js';
import {
  createVehicleSchema,
  updateVehicleSchema,
  uploadVehicleDocumentSchema,
} from './schemas/vehicleSchemas.js';

export const vehicleRouter = Router();

vehicleRouter.use(authenticate);

// claude.md §8: only a DRIVER may register a vehicle. Reading/updating/
// uploading documents for an existing vehicle is scoped by ownership in the
// service layer instead — every owner is already a DRIVER by construction.
vehicleRouter.post('/', authorize('DRIVER'), validateBody(createVehicleSchema), vehicleController.create);

vehicleRouter.get('/', vehicleController.list);

vehicleRouter.get('/:id', vehicleController.getById);

vehicleRouter.patch('/:id', validateBody(updateVehicleSchema), vehicleController.update);

vehicleRouter.post(
  '/:id/documents',
  uploadDocument,
  validateBody(uploadVehicleDocumentSchema),
  validateDocumentFile,
  vehicleController.uploadDocument,
);
