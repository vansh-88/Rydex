import { Router } from 'express';

import { prisma } from '../../infrastructure/database/prismaClient.js';
import { sendSuccess } from '../../shared/http/response.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

healthRouter.get('/ready', async (req, res) => {
  // Redis readiness check is added once Phase 3 introduces a Redis client.
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, { status: 'ready' });
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not reachable' },
      requestId: req.id,
    });
  }
});
