import { Router } from 'express';

import { authenticate } from '../../app/middleware/authenticate.js';
import { idParamSchema, validateParams, validateQuery } from '../../app/middleware/validate.js';
import * as chatController from './controllers/chatController.js';
import { listConversationsQuerySchema, listMessagesQuerySchema } from './schemas/chatSchemas.js';

// claude.md §47: REST covers conversation/message history discovery; actual
// message sending happens over the WebSocket flow only (src/modules/chat/socket).
// Scoped to the caller's own conversations in the service layer
// (conversationRepository.listForUser / conversationService.authorizeParticipant),
// same reasoning as the notification module — no separate authorization rule
// needed here.
export const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get('/', validateQuery(listConversationsQuerySchema), chatController.listConversations);
chatRouter.get(
  '/:id/messages',
  validateParams(idParamSchema),
  validateQuery(listMessagesQuerySchema),
  chatController.listMessages,
);
