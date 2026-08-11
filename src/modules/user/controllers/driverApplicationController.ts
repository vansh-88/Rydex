import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import * as driverApplicationService from '../services/driverApplicationService.js';

// req.file is guaranteed by the uploadDocument + validateDocumentFile
// middleware chain running before this handler.
export const submit: RequestHandler = async (req, res) => {
  const result = await driverApplicationService.submitDriverApplication(req.user!.id, {
    buffer: req.file!.buffer,
  });
  sendSuccess(res, result);
};
