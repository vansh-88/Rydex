import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authorize } from '../../app/middleware/authorize.js';
import { uploadDocument, validateDocumentFile } from '../../app/middleware/uploadDocument.js';
import { idParamSchema, validateBody, validateParams } from '../../app/middleware/validate.js';
import { documentUploadLimit } from '../../app/middleware/rateLimits.js';
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

vehicleRouter.get('/:id', validateParams(idParamSchema), vehicleController.getById);

vehicleRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateVehicleSchema),
  vehicleController.update,
);

// Rate limit runs before multer so a flood of oversized uploads is rejected
// before their bodies are buffered into memory.
vehicleRouter.post(
  '/:id/documents',
  documentUploadLimit,
  validateParams(idParamSchema),
  uploadDocument,
  validateBody(uploadVehicleDocumentSchema),
  validateDocumentFile,
  vehicleController.uploadDocument,
);
