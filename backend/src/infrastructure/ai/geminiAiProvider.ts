import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';

import { AppError } from '../../shared/errors/AppError.js';
import type {
  AICompletionRequest,
  AICompletionResult,
  AIMessage,
  AIProvider,
  AIToolCall,
} from './aiProvider.js';

// Gemini has no distinct "tool" role on Content (unlike OpenAI-style
// wire formats) — a function's result is a `functionResponse` Part inside
// a 'user'-role Content instead (claude.md §96.5 references this as the
// reason a vendor SDK was chosen over hand-rolling `fetch`, unlike
// GeoapifyMapProvider: this translation is exactly the kind of
// protocol-specific detail worth getting from the vendor's own SDK types).
function toGeminiContents(messages: AIMessage[]): Content[] {
  const contents: Content[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      continue; // handled separately as systemInstruction
    }

    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.content ?? '' }] });
      continue;
    }

    if (message.role === 'assistant') {
      if (message.toolCalls && message.toolCalls.length > 0) {
        contents.push({
          role: 'model',
          parts: message.toolCalls.map((call) => ({
            functionCall: { id: call.id, name: call.name, args: call.arguments },
            // Required by newer Gemini models — a function-call part
            // without its original thought_signature is rejected outright
            // when replayed on a later turn.
            ...(call.providerState !== undefined ? { thoughtSignature: call.providerState } : {}),
          })),
        });
      } else {
        contents.push({ role: 'model', parts: [{ text: message.content ?? '' }] });
      }
      continue;
    }

    // message.role === 'tool'. Gemini requires `functionResponse.response`
    // to be a JSON object, never a bare array/primitive — our tool results
    // are often arrays (e.g. getMyRecentBookings), so anything that isn't
    // already a plain object gets wrapped rather than passed through raw.
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.content ?? 'null');
    } catch {
      parsed = message.content ?? '';
    }
    const response: Record<string, unknown> =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { result: parsed };
    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            ...(message.toolCallId !== undefined ? { id: message.toolCallId } : {}),
            ...(message.toolName !== undefined ? { name: message.toolName } : {}),
            response,
          },
        },
      ],
    });
  }

  return contents;
}

// The SDK throws an `ApiError` carrying the upstream HTTP status as a
// numeric `status` property. Read it structurally rather than importing the
// SDK's error class, so this stays resilient to the SDK reshaping its error
// exports.
function isProviderStatus(err: unknown, status: number): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: unknown }).status === status;
}

function systemInstructionFrom(messages: AIMessage[]): string | undefined {
  const systemText = messages
    .filter((message) => message.role === 'system' && message.content)
    .map((message) => message.content)
    .join('\n\n');
  return systemText.length > 0 ? systemText : undefined;
}

// claude.md §96.5: Gemini is the initial AIProvider implementation. Uses
// the official @google/genai SDK rather than raw `fetch` (unlike
// GeoapifyMapProvider) — the tool-calling protocol above is intricate
// enough that hand-rolling it risks subtle bugs in exactly the code path
// that enforces the ownership boundary, the same correctness trade-off
// RazorpayProvider made for signature verification (claude.md §37).
export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly modelName: string,
    private readonly timeoutMs: number,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const systemInstruction = systemInstructionFrom(request.messages);

    let response;
    try {
      response = await this.client.models.generateContent({
        model: this.modelName,
        contents: toGeminiContents(request.messages),
        config: {
          ...(systemInstruction !== undefined ? { systemInstruction } : {}),
          ...(request.tools && request.tools.length > 0
            ? {
                tools: [
                  {
                    functionDeclarations: request.tools.map((tool) => ({
                      name: tool.name,
                      description: tool.description,
                      parametersJsonSchema: tool.parameters,
                    })),
                  },
                ],
              }
            : {}),
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new AppError(504, 'AI_PROVIDER_TIMEOUT', 'AI provider request timed out');
      }
      // claude.md §96.5/§55: the provider's own quota/rate-limit rejection is
      // a distinct, actionable condition (retry later) from a generic
      // provider failure — surfaced as its own code so a client can tell
      // "try again shortly" from "something is broken". The upstream 429 is
      // deliberately NOT forwarded as a 429 to our client: our own rate
      // limits (routes.ts) are what govern the caller, and reporting the
      // vendor's quota as the caller's would be misleading.
      if (isProviderStatus(err, 429)) {
        throw new AppError(503, 'AI_PROVIDER_RATE_LIMITED', 'AI provider is rate limited. Please try again shortly.');
      }
      throw new AppError(502, 'AI_PROVIDER_ERROR', 'Failed to reach the AI provider');
    }

    // Read function calls straight off the first candidate's parts, not the
    // flattened `response.functionCalls` getter — that getter drops each
    // part's sibling `thoughtSignature`, which must be captured and echoed
    // back on the next turn (see toGeminiContents above).
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: AIToolCall[] = [];
    parts.forEach((part, index) => {
      if (!part.functionCall) {
        return;
      }
      toolCalls.push({
        id: part.functionCall.id ?? `call_${index}`,
        name: part.functionCall.name ?? '',
        arguments: part.functionCall.args ?? {},
        ...(part.thoughtSignature !== undefined ? { providerState: part.thoughtSignature } : {}),
      });
    });

    return {
      content: toolCalls.length > 0 ? null : (response.text ?? null),
      toolCalls,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : null,
      model: this.modelName,
    };
  }
}
