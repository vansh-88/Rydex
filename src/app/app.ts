import cors from 'cors';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';

import { corsOrigins, env } from '../config/env.js';
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

  // claude.md §49/§65: every per-IP rate limit reads req.ip, which is only
  // the real client when a trusted proxy sets X-Forwarded-For. Off by
  // default on purpose — see TRUST_PROXY in config/env.ts for why enabling
  // this without a proxy in front is itself a vulnerability.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      // Exactly the verbs the routers actually register — no DELETE/PUT
      // route exists, so advertising them only widens the surface.
      methods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      // No cookies/credentials are used anywhere — auth is a Bearer token
      // (claude.md §10). Leaving this false keeps the browser from ever
      // attaching ambient credentials to a cross-origin call.
      credentials: false,
      maxAge: 86400,
    }),
  );
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
