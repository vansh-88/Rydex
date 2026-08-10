import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from '../config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { registerRoutes } from './routes.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
