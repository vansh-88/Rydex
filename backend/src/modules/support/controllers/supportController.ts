import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type {
  CreateConversationInput,
  GetConversationQuery,
  ListConversationsQuery,
  PostMessageInput,
} from '../schemas/supportSchemas.js';
import * as chatbotService from '../services/chatbotService.js';

export const createConversation: RequestHandler<unknown, unknown, CreateConversationInput> = async (
  req,
  res,
) => {
  const result = await chatbotService.createConversation(req.user!.id, req.body.message);
  sendSuccess(res, result, 201);
};

// Query is validated/coerced by validateQuery into req.validatedQuery
// (see app/middleware/validate.ts — Express 5's req.query has no setter).
export const listConversations: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as ListConversationsQuery;
  const result = await chatbotService.listConversations(req.user!.id, query.cursor, query.limit);
  sendSuccess(res, result);
};

export const getConversation: RequestHandler<{ id: string }> = async (req, res) => {
  const query = req.validatedQuery as GetConversationQuery;
  const result = await chatbotService.getConversation(
    req.user!.id,
    req.params.id,
    query.cursor,
    query.limit,
  );
  sendSuccess(res, result);
};

export const postMessage: RequestHandler<{ id: string }, unknown, PostMessageInput> = async (
  req,
  res,
) => {
  const reply = await chatbotService.postMessage(req.user!.id, req.params.id, req.body.message);
  sendSuccess(res, reply, 201);
};
