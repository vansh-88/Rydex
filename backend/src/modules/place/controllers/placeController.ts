import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { AutocompleteQuery } from '../schemas/placeSchemas.js';
import * as placeService from '../services/placeService.js';

// Query is validated/coerced by validateQuery into req.validatedQuery
// (see app/middleware/validate.ts — Express 5's req.query has no setter).
export const autocomplete: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as AutocompleteQuery;
  const result = await placeService.autocomplete(query.q, query.limit);
  sendSuccess(res, result);
};
