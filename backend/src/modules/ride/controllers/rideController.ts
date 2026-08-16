import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { SearchRidesQuery } from '../schemas/rideSearchSchemas.js';
import type { CreateRideInput, ListMyRidesQuery } from '../schemas/rideSchemas.js';
import * as rideSearchService from '../services/rideSearchService.js';
import * as rideService from '../services/rideService.js';

export const create: RequestHandler<unknown, unknown, CreateRideInput> = async (req, res) => {
  const result = await rideService.createRide(req.user!.id, req.body);
  sendSuccess(res, result, 201);
};

// Dry run — computes route, fare and posting commission without creating
// anything, so the driver sees what publishing costs before committing.
export const preview: RequestHandler<unknown, unknown, CreateRideInput> = async (req, res) => {
  const result = await rideService.previewRide(req.user!.id, req.body);
  sendSuccess(res, result);
};

// Query is validated/coerced by validateQuery(searchRidesQuerySchema) into
// req.validatedQuery — see app/middleware/validate.ts for why (Express 5's
// req.query has no setter).
export const search: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as SearchRidesQuery;
  const result = await rideSearchService.searchRides(query);
  sendSuccess(res, result);
};

// Query is validated/coerced by validateQuery into req.validatedQuery
// (see app/middleware/validate.ts — Express 5's req.query has no setter).
export const listMine: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as ListMyRidesQuery;
  const result = await rideService.listMyRides(req.user!.id, query.scope, query.cursor, query.limit);
  sendSuccess(res, result);
};

export const getById: RequestHandler<{ id: string }> = async (req, res) => {
  const ride = await rideService.getRide(req.params.id);
  sendSuccess(res, ride);
};

export const cancel: RequestHandler<{ id: string }> = async (req, res) => {
  const ride = await rideService.cancelRide(req.user!.id, req.params.id);
  sendSuccess(res, ride);
};

export const start: RequestHandler<{ id: string }> = async (req, res) => {
  const ride = await rideService.startRide(req.user!.id, req.params.id);
  sendSuccess(res, ride);
};

export const complete: RequestHandler<{ id: string }> = async (req, res) => {
  const ride = await rideService.completeRide(req.user!.id, req.params.id);
  sendSuccess(res, ride);
};
