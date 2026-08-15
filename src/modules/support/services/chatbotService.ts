import { env } from '../../../config/env.js';
import { aiProvider, aiProviderName } from '../../../infrastructure/ai/index.js';
import type {
  AICompletionRequest,
  AICompletionResult,
  AIMessage,
  AIToolCall,
} from '../../../infrastructure/ai/aiProvider.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { buildSystemPrompt } from '../prompts/systemPrompt.js';
import * as supportRepository from '../repositories/supportRepository.js';
import type {
  SupportConversationRecord,
  SupportMessageRecord,
} from '../repositories/supportRepository.js';
import {
  decodeConversationCursor,
  decodeMessageCursor,
  encodeConversationCursor,
  encodeMessageCursor,
} from './supportCursor.js';
import { executeToolCall, SUPPORT_TOOL_DEFINITIONS } from './supportToolService.js';

export interface SupportConversationDto {
  id: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
}

function toConversationDto(conversation: SupportConversationRecord): SupportConversationDto {
  return {
    id: conversation.id,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
  };
}

export interface SupportMessageDto {
  id: string;
  role: string;
  content: string | null;
  createdAt: string;
}

function toMessageDto(message: SupportMessageRecord): SupportMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

// claude.md §96.5: DB role values are uppercase (matches the
// OpenAI/Gemini-style wire vocabulary AIProvider is built around);
// AIMessage.role is lowercase. This is the only place the two vocabularies
// meet.
function toAIMessage(record: SupportMessageRecord): AIMessage {
  const role = record.role.toLowerCase() as AIMessage['role'];
  const contentField = record.content !== null ? { content: record.content } : {};

  if (record.role === 'ASSISTANT' && record.toolCalls) {
    return { role, ...contentField, toolCalls: record.toolCalls as unknown as AIToolCall[] };
  }
  if (record.role === 'TOOL') {
    return {
      role,
      ...contentField,
      ...(record.toolCallId !== null ? { toolCallId: record.toolCallId } : {}),
      ...(record.toolName !== null ? { toolName: record.toolName } : {}),
    };
  }
  return { role, ...contentField };
}

// claude.md §10 (conversation memory): recent-message window only, bounded
// by SUPPORT_CHAT_MAX_HISTORY_MESSAGES — "do not blindly send the entire
// conversation history to the LLM forever." This function is the seam a
// future summarization/compaction pass would change; nothing above or
// below it needs to know that happened.
async function buildContext(conversationId: string): Promise<AIMessage[]> {
  const records = await supportRepository.listRecentMessagesForContext(
    conversationId,
    env.SUPPORT_CHAT_MAX_HISTORY_MESSAGES,
  );
  return [{ role: 'system', content: buildSystemPrompt() }, ...records.map(toAIMessage)];
}

// claude.md §96.5 (Tool/context layer): the bounded tool-calling loop.
// Each round is one AIProvider.complete() call; if the model requests tool
// calls, they're executed (supportToolService, ownership-checked, no
// userId ever taken from the model) and fed back, then the loop tries
// again — capped at SUPPORT_CHAT_MAX_TOOL_ROUNDS so a confused model can't
// spiral into unbounded provider calls (claude.md §13 bounded retries).
async function completeOrRecordFailure(
  conversationId: string,
  request: AICompletionRequest,
): Promise<AICompletionResult> {
  try {
    return await aiProvider.complete(request);
  } catch (err) {
    await supportRepository.createMessage({
      conversationId,
      role: 'ASSISTANT',
      status: 'FAILED',
      errorCode: err instanceof AppError ? err.code : 'AI_PROVIDER_ERROR',
      provider: aiProviderName,
    });
    throw err;
  }
}

async function runTurn(conversationId: string, userId: string): Promise<SupportMessageDto> {
  const context = await buildContext(conversationId);

  for (let round = 0; round < env.SUPPORT_CHAT_MAX_TOOL_ROUNDS; round += 1) {
    const result = await completeOrRecordFailure(conversationId, {
      messages: context,
      tools: SUPPORT_TOOL_DEFINITIONS,
    });

    const usageFields = result.usage
      ? { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens }
      : {};

    if (result.toolCalls.length === 0) {
      const saved = await supportRepository.createMessage({
        conversationId,
        role: 'ASSISTANT',
        ...(result.content !== null ? { content: result.content } : {}),
        provider: aiProviderName,
        model: result.model,
        ...usageFields,
      });
      return toMessageDto(saved);
    }

    await supportRepository.createMessage({
      conversationId,
      role: 'ASSISTANT',
      toolCalls: result.toolCalls,
      provider: aiProviderName,
      model: result.model,
      ...usageFields,
    });
    context.push({ role: 'assistant', toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const toolResult = await executeToolCall(userId, call);
      await supportRepository.createMessage({
        conversationId,
        role: 'TOOL',
        content: toolResult.content,
        toolCallId: call.id,
        toolName: call.name,
        toolArguments: call.arguments,
        status: toolResult.isError ? 'FAILED' : 'COMPLETED',
      });
      context.push({
        role: 'tool',
        content: toolResult.content,
        toolCallId: call.id,
        toolName: call.name,
      });
    }
  }

  // The tool-round budget is spent. Previously this threw
  // AI_PROVIDER_ERROR — which made every question needing the full budget
  // fail, and blamed the provider for what was really our own cap. Note the
  // loop above runs SUPPORT_CHAT_MAX_TOOL_ROUNDS *tool* rounds, so answering
  // needs one more completion than that: with the default of 2, "what's the
  // status of my booking, and of its ride?" spent both rounds on
  // getMyRecentBookings + getRideStatus and never got a turn to write the
  // answer it already had the data for.
  //
  // So: one last completion with the tools withheld. The model cannot request
  // another call and must answer from the tool results already in context,
  // which is exactly the graceful degradation this path should have had.
  const final = await completeOrRecordFailure(conversationId, { messages: context });

  if (final.content === null) {
    await supportRepository.createMessage({
      conversationId,
      role: 'ASSISTANT',
      status: 'FAILED',
      errorCode: 'AI_PROVIDER_ERROR',
      provider: aiProviderName,
      model: final.model,
    });
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'The assistant could not produce a response');
  }

  const saved = await supportRepository.createMessage({
    conversationId,
    role: 'ASSISTANT',
    content: final.content,
    provider: aiProviderName,
    model: final.model,
    ...(final.usage
      ? { promptTokens: final.usage.promptTokens, completionTokens: final.usage.completionTokens }
      : {}),
  });
  return toMessageDto(saved);
}

async function getOwnedConversationOrThrow(
  userId: string,
  conversationId: string,
): Promise<SupportConversationRecord> {
  const conversation = await supportRepository.findConversationById(conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw new AppError(404, 'SUPPORT_CONVERSATION_NOT_FOUND', 'Conversation not found');
  }
  return conversation;
}

export async function createConversation(
  userId: string,
  message: string,
): Promise<{ conversation: SupportConversationDto; reply: SupportMessageDto }> {
  const conversation = await supportRepository.createConversation(userId);
  await supportRepository.createMessage({
    conversationId: conversation.id,
    role: 'USER',
    content: message,
  });
  await supportRepository.touchConversation(conversation.id);

  const reply = await runTurn(conversation.id, userId);
  await supportRepository.touchConversation(conversation.id);

  return { conversation: toConversationDto(conversation), reply };
}

export async function postMessage(
  userId: string,
  conversationId: string,
  message: string,
): Promise<SupportMessageDto> {
  const conversation = await getOwnedConversationOrThrow(userId, conversationId);
  await supportRepository.createMessage({
    conversationId: conversation.id,
    role: 'USER',
    content: message,
  });
  await supportRepository.touchConversation(conversation.id);

  const reply = await runTurn(conversation.id, userId);
  await supportRepository.touchConversation(conversation.id);

  return reply;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

export async function listConversations(
  userId: string,
  cursorRaw: string | undefined,
  limitRaw: number | undefined,
): Promise<{ items: SupportConversationDto[]; nextCursor: string | null }> {
  const limit = Math.min(limitRaw ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const cursor = cursorRaw !== undefined ? decodeConversationCursor(cursorRaw) : null;

  const rows = await supportRepository.listConversationsByUser(userId, cursor, limit);
  const items = rows.map(toConversationDto);

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeConversationCursor({ lastMessageAt: last.lastMessageAt.toISOString(), id: last.id })
      : null;

  return { items, nextCursor };
}

export async function getConversation(
  userId: string,
  conversationId: string,
  cursorRaw: string | undefined,
  limitRaw: number | undefined,
): Promise<{
  conversation: SupportConversationDto;
  messages: { items: SupportMessageDto[]; nextCursor: string | null };
}> {
  const conversation = await getOwnedConversationOrThrow(userId, conversationId);

  const limit = Math.min(limitRaw ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const cursor = cursorRaw !== undefined ? decodeMessageCursor(cursorRaw) : null;

  const rows = await supportRepository.listMessagesByConversation(conversationId, cursor, limit);
  const items = rows.map(toMessageDto);

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeMessageCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null;

  return { conversation: toConversationDto(conversation), messages: { items, nextCursor } };
}
