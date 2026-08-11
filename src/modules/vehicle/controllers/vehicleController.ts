import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  UploadVehicleDocumentInput,
} from '../schemas/vehicleSchemas.js';
import * as vehicleService from '../services/vehicleService.js';

export const create: RequestHandler<unknown, unknown, CreateVehicleInput> = async (req, res) => {
  const vehicle = await vehicleService.createVehicle(req.user!.id, req.body);
  sendSuccess(res, vehicle, 201);
};

export const list: RequestHandler = async (req, res) => {
  const items = await vehicleService.listVehicles(req.user!.id);
  sendSuccess(res, { items });
};

export const getById: RequestHandler<{ id: string }> = async (req, res) => {
  const vehicle = await vehicleService.getVehicle(req.user!.id, req.params.id);
  sendSuccess(res, vehicle);
};

export const update: RequestHandler<{ id: string }, unknown, UpdateVehicleInput> = async (
  req,
  res,
) => {
  const vehicle = await vehicleService.updateVehicle(req.user!.id, req.params.id, req.body);
  sendSuccess(res, vehicle);
};

// req.file is guaranteed by the uploadDocument + validateDocumentFile
// middleware chain running before this handler.
export const uploadDocument: RequestHandler<
  { id: string },
  unknown,
  UploadVehicleDocumentInput
> = async (req, res) => {
  const document = await vehicleService.uploadVehicleDocument(
    req.user!.id,
    req.params.id,
    req.body.documentType,
    { buffer: req.file!.buffer },
  );
  sendSuccess(res, document, 201);
};
