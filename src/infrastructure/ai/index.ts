import { env } from '../../config/env.js';
import type { AIProvider } from './aiProvider.js';
import { ConsoleAIProvider } from './consoleAiProvider.js';
import { GeminiProvider } from './geminiAiProvider.js';

// Mirrors infrastructure/email/index.ts and infrastructure/payments/
// index.ts's real-vs-console-fallback pattern: configured key -> real
// Gemini, otherwise a console provider that never talks to a real model.
// claude.md §97 (2026-08-16): originally speced with Grok as the initial
// provider; corrected to Gemini before implementation since that's the key
// actually available.
function createAIProvider(): { provider: AIProvider; name: string } {
  if (env.GEMINI_API_KEY !== undefined && env.GEMINI_API_KEY.length > 0) {
    return {
      provider: new GeminiProvider(
        env.GEMINI_API_KEY,
        env.GEMINI_MODEL,
        env.SUPPORT_CHAT_PROVIDER_TIMEOUT_MS,
      ),
      name: 'gemini',
    };
  }

  console.warn(
    'GEMINI_API_KEY not set — using ConsoleAIProvider. No real AI support responses will be generated. See claude.md §96.5/Phase 13.5.',
  );
  return { provider: new ConsoleAIProvider(), name: 'console' };
}

const created = createAIProvider();
export const aiProvider: AIProvider = created.provider;
// claude.md §96.5: the `provider` column value stamped on every
// SupportMessage row — chatbotService uses this rather than each call site
// guessing which concrete provider is active (same reasoning as
// paymentProviderName).
export const aiProviderName: string = created.name;

export type {
  AICompletionRequest,
  AICompletionResult,
  AIMessage,
  AIProvider,
  AIToolCall,
  AIToolDefinition,
  AIUsage,
} from './aiProvider.js';
