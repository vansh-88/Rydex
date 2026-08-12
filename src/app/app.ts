import cors from 'cors';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';

import { env } from '../config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { registerRoutes } from './routes.js';

declare module 'express-serve-static-core' {
  interface Request {
    // Captured by express.json()'s `verify` hook below — the exact bytes
    // received, before JSON parsing. claude.md §40: webhook signature
    // verification needs the raw bytes a provider actually signed, not a
    // re-serialized JSON string (whitespace/key-order can differ).
    rawBody?: Buffer;
  }
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
