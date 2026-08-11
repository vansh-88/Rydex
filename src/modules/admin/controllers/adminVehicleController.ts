import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/AppError.js';
import { sendSuccess } from '../../../shared/http/response.js';
import { listVehiclesStatusSchema } from '../schemas/vehicleSchemas.js';
import type { RejectVehicleInput } from '../schemas/vehicleSchemas.js';
import * as adminVehicleService from '../services/adminVehicleService.js';

export const list: RequestHandler = async (req, res) => {
  const status = listVehiclesStatusSchema.safeParse(req.query.status);
  if (!status.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Only status=PENDING is supported');
  }

  const items = await adminVehicleService.listPendingVehicles();
  sendSuccess(res, { items });
};

export const getById: RequestHandler<{ id: string }> = async (req, res) => {
  const review = await adminVehicleService.getVehicleById(req.params.id);
  sendSuccess(res, review);
};

export const verify: RequestHandler<{ id: string }> = async (req, res) => {
  await adminVehicleService.verifyVehicle(req.user!.id, req.params.id);
  sendSuccess(res, { message: 'Vehicle verified.' });
};

export const reject: RequestHandler<{ id: string }, unknown, RejectVehicleInput> = async (
  req,
  res,
) => {
  await adminVehicleService.rejectVehicle(req.user!.id, req.params.id, req.body.rejectionReason);
  sendSuccess(res, { message: 'Vehicle rejected.' });
};
