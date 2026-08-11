import { Router } from 'express';

import { prisma } from '../../infrastructure/database/prismaClient.js';
import { redis } from '../../infrastructure/redis/redisClient.js';
import { sendSuccess } from '../../shared/http/response.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

healthRouter.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not reachable' },
      requestId: req.id,
    });
    return;
  }

  try {
    await redis.ping();
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'REDIS_UNAVAILABLE', message: 'Redis is not reachable' },
      requestId: req.id,
    });
    return;
  }

  sendSuccess(res, { status: 'ready' });
});
