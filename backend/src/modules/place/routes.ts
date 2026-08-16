import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { authenticatedReadLimit } from '../../app/middleware/rateLimits.js';
import { validateQuery } from '../../app/middleware/validate.js';
import * as placeController from './controllers/placeController.js';
import { autocompleteQuerySchema } from './schemas/placeSchemas.js';

// Ride creation and ride search both take coordinates and never free text
// (claude.md §18/§20/§23), which leaves the client needing a way to turn what
// a user types into a coordinate pair. Proxying it here rather than letting
// the browser call Geoapify directly keeps MAP_PROVIDER_API_KEY server-side
// and makes the spend rate-limitable per user — an autocomplete field fires
// a request every few keystrokes, so this is the one read endpoint where an
// unbounded client could quietly burn the whole provider quota.
export const placeRouter = Router();

placeRouter.use(authenticate);

placeRouter.get(
  '/autocomplete',
  authenticatedReadLimit,
  validateQuery(autocompleteQuerySchema),
  placeController.autocomplete,
);
