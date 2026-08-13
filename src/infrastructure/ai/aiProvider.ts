export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  // Opaque provider-specific continuation state that must be echoed back
  // verbatim on the next round for providers that require it (e.g.
  // Gemini's thought_signature, tying a function call back to the model's
  // internal reasoning across turns). Providers that don't need this never
  // set it. ChatbotService/supportRepository persist and replay it
  // opaquely, without interpreting it — this keeps that requirement out of
  // the provider-agnostic interface's naming while still allowing it.
  providerState?: string;
}

export interface AIMessage {
  role: AIMessageRole;
  // Present for system/user/assistant text turns; omitted for a pure
  // tool-call assistant turn (toolCalls set instead) or absent entirely.
  content?: string;
  // Set on an ASSISTANT message that requests one or more tool calls.
  // claude.md §96.5: never includes a userId/identity argument — only
  // resource-scoped parameters (bookingId/rideId) the caller extracted
  // from the conversation.
  toolCalls?: AIToolCall[];
  // Set on a TOOL message: which call this result answers. `content` on a
  // TOOL message is the JSON-stringified result.
  toolCallId?: string;
  toolName?: string;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  // JSON Schema object describing the tool's parameters (an "object" type
  // schema with "properties"/"required") — provider-agnostic; each
  // AIProvider implementation translates this to its own vendor format.
  parameters: Record<string, unknown>;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  tools?: AIToolDefinition[];
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICompletionResult {
  // Null when the model requested tool calls instead of a final answer.
  content: string | null;
  toolCalls: AIToolCall[];
  usage: AIUsage | null;
  model: string;
}

// claude.md §96.5: ChatbotService depends only on this interface, never on
// a concrete vendor SDK — same Strategy pattern as MapProvider (§17) and
// PaymentProvider (§37). Implementations: GeminiProvider (initial, real
// LLM calls) and ConsoleAIProvider (local-dev fallback).
export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}
