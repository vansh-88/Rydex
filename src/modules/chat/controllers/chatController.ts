import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { ListConversationsQuery, ListMessagesQuery } from '../schemas/chatSchemas.js';
import * as conversationService from '../services/conversationService.js';

// Query is validated/coerced by validateQuery into req.validatedQuery
// (see app/middleware/validate.ts — Express 5's req.query has no setter).
export const listConversations: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as ListConversationsQuery;
  const result = await conversationService.listConversations(req.user!.id, query.cursor, query.limit);
  sendSuccess(res, result);
};

export const listMessages: RequestHandler<{ id: string }> = async (req, res) => {
  const query = req.validatedQuery as ListMessagesQuery;
  const result = await conversationService.listMessages(req.user!.id, req.params.id, query.cursor, query.limit);
  sendSuccess(res, result);
};
