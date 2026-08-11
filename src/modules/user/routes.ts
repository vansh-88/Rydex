import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { validateBody } from '../../app/middleware/validate.js';
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
