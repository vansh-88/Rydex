import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { documentUploadLimit } from '../../app/middleware/rateLimits.js';
import { uploadDocument, validateDocumentFile } from '../../app/middleware/uploadDocument.js';
import { validateBody } from '../../app/middleware/validate.js';
import * as deviceController from '../notification/controllers/deviceController.js';
import { registerDeviceSchema } from '../notification/schemas/notificationSchemas.js';
import * as driverApplicationController from './controllers/driverApplicationController.js';
import * as userController from './controllers/userController.js';
import { updateProfileSchema } from './schemas/userSchemas.js';

export const userRouter = Router();

userRouter.get('/me', authenticate, userController.getMe);

userRouter.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  userController.updateMe,
);

userRouter.post(
  '/me/driver-application',
  authenticate,
  documentUploadLimit,
  uploadDocument,
  validateDocumentFile,
  driverApplicationController.submit,
);

userRouter.post(
  '/me/devices',
  authenticate,
  validateBody(registerDeviceSchema),
  deviceController.register,
);
