import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { CreateRideInput } from '../schemas/rideSchemas.js';
import * as rideService from '../services/rideService.js';

export const create: RequestHandler<unknown, unknown, CreateRideInput> = async (req, res) => {
  const result = await rideService.createRide(req.user!.id, req.body);
  sendSuccess(res, result, 201);
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
