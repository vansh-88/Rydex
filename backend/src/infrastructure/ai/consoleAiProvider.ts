import type { AICompletionRequest, AICompletionResult, AIProvider } from './aiProvider.js';

// Dev-only fallback used when GEMINI_API_KEY isn't configured — same role
// as ConsoleEmailProvider/ConsolePushProvider/StubPaymentProvider. Never
// requests a tool call (there's no real model deciding to), so the
// tool-calling loop in chatbotService always terminates after one round in
// this mode.
export class ConsoleAIProvider implements AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');
    console.log(`[dev AI fallback] would answer: "${lastUserMessage?.content ?? ''}"`);

    return Promise.resolve({
      content:
        'AI support is not configured in this environment (no GEMINI_API_KEY set), so this is a placeholder response.',
      toolCalls: [],
      usage: null,
      model: 'console-fallback',
    });
  }
}
