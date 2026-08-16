import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/AppError.js';
import { sendSuccess } from '../../../shared/http/response.js';
import { listDriverApplicationsStatusSchema } from '../schemas/driverApplicationSchemas.js';
import type { RejectDriverApplicationInput } from '../schemas/driverApplicationSchemas.js';
import * as adminDriverApplicationService from '../services/adminDriverApplicationService.js';

export const list: RequestHandler = async (req, res) => {
  const status = listDriverApplicationsStatusSchema.safeParse(req.query.status);
  if (!status.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Only status=PENDING is supported');
  }

  const items = await adminDriverApplicationService.listPendingDriverApplications();
  sendSuccess(res, { items });
};

export const verify: RequestHandler<{ userId: string }> = async (req, res) => {
  await adminDriverApplicationService.verifyDriverApplication(req.user!.id, req.params.userId);
  sendSuccess(res, { message: 'Driver application verified.' });
};

export const reject: RequestHandler<
  { userId: string },
  unknown,
  RejectDriverApplicationInput
> = async (req, res) => {
  await adminDriverApplicationService.rejectDriverApplication(
    req.user!.id,
    req.params.userId,
    req.body.rejectionReason,
  );
  sendSuccess(res, { message: 'Driver application rejected.' });
};
