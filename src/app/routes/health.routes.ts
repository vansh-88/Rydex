import { Router } from 'express';

import { sendSuccess } from '../../shared/http/response.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

healthRouter.get('/ready', (_req, res) => {
  // No external dependencies wired up yet — Phase 2 adds real Postgres/
  // Redis connectivity checks here (claude.md §62).
  sendSuccess(res, { status: 'ready' });
});
