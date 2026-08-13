import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { validateBody, validateQuery } from '../../app/middleware/validate.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../infrastructure/redis/rateLimit.js';
import * as supportController from './controllers/supportController.js';
import {
  createConversationSchema,
  getConversationQuerySchema,
  listConversationsQuerySchema,
  postMessageSchema,
} from './schemas/supportSchemas.js';

export const supportRouter = Router();

supportRouter.use(authenticate);

// claude.md §96.5/§12-13, steps.md §18: AI support chat gets its own
// rate-limit category — unlike most of this API, each request has a real
// per-call cost. Per-user short window plus a per-user daily cap, reusing
// the same rateLimit() factory auth/routes.ts uses for OTP (a daily cap is
// just a rate limit with a long window).
const perUserShortWindow = rateLimit({
  keyPrefix: 'support-chat-user',
  windowSeconds: env.SUPPORT_CHAT_RATE_LIMIT_WINDOW_SECONDS,
  max: env.SUPPORT_CHAT_RATE_LIMIT_MAX,
  code: 'SUPPORT_CHAT_RATE_LIMITED',
  message: 'Too many chat messages. Please slow down.',
  keyFn: (req) => req.user!.id,
});

const perUserDaily = rateLimit({
  keyPrefix: 'support-chat-user-daily',
  windowSeconds: 86400,
  max: env.SUPPORT_CHAT_DAILY_MESSAGE_LIMIT,
  code: 'SUPPORT_CHAT_DAILY_LIMIT_REACHED',
  message: "You've reached today's chat message limit.",
  keyFn: (req) => req.user!.id,
});

supportRouter.post(
  '/conversations',
  validateBody(createConversationSchema),
  perUserShortWindow,
  perUserDaily,
  supportController.createConversation,
);
supportRouter.get(
  '/conversations',
  validateQuery(listConversationsQuerySchema),
  supportController.listConversations,
);
supportRouter.get(
  '/conversations/:id',
  validateQuery(getConversationQuerySchema),
  supportController.getConversation,
);
supportRouter.post(
  '/conversations/:id/messages',
  validateBody(postMessageSchema),
  perUserShortWindow,
  perUserDaily,
  supportController.postMessage,
);
