import { Loader2, MessageCircleQuestion, Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  getSupportConversation,
  listSupportConversations,
  sendSupportMessage,
  startSupportConversation,
  SUPPORT_MAX_MESSAGE_LENGTH,
} from '@/api/endpoints/support';
import { useApiQuery } from '@/api/hooks';
import { invalidate } from '@/api/store';
import { ApiError } from '@/api/client';
import type { SupportMessage } from '@/api/types';
import { InlineError } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatDay, formatTime } from '@/lib/kolkataDate';

// The conversation also holds SYSTEM prompts and TOOL call records — internal
// machinery that would be noise (and a small information leak) in the
// transcript a user reads.
const VISIBLE_ROLES = new Set(['USER', 'ASSISTANT']);

const SUGGESTIONS = [
  'Where is my upcoming trip?',
  'How do refunds work if I cancel?',
  'Why do I pay only part of the fare upfront?',
];

export function Support() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading } = useApiQuery(
    'support:conversations',
    useCallback((signal: AbortSignal) => listSupportConversations(undefined, signal), []),
  );

  // Load a past conversation when one is selected.
  useEffect(() => {
    if (conversationId === null) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const result = await getSupportConversation(conversationId, controller.signal);
        if (controller.signal.aborted) return;
        // History comes back newest-first; a transcript reads oldest-first.
        setMessages([...result.messages.items].reverse());
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending]);

  async function submit(event: FormEvent, override?: string) {
    event.preventDefault();
    const text = (override ?? draft).trim();
    if (text.length === 0 || sending) return;

    setSending(true);
    setError(undefined);

    // Shown immediately with a temporary id. The user's own message is not
    // echoed back by the API — only the assistant's reply is — so rendering
    // it locally is correct here (unlike ride chat, where the server echoes).
    const optimistic: SupportMessage = {
      id: `local-${String(Date.now())}`,
      role: 'USER',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setDraft('');

    try {
      if (conversationId === null) {
        const result = await startSupportConversation(text);
        setConversationId(result.conversation.id);
        setMessages((current) => [...current, result.reply]);
        invalidate('support');
      } else {
        const reply = await sendSupportMessage(conversationId, text);
        setMessages((current) => [...current, reply]);
      }
    } catch (caught) {
      setError(caught);
      // Roll back the optimistic message: it never reached the server, and
      // leaving it would imply it did.
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  const visible = messages.filter(
    (message) => VISIBLE_ROLES.has(message.role) && message.content !== null,
  );

  const rateLimited =
    error instanceof ApiError &&
    (error.code === 'SUPPORT_CHAT_RATE_LIMITED' ||
      error.code === 'SUPPORT_CHAT_DAILY_LIMIT_REACHED');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Help</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Ask about your trips, payments or anything else on Rydex.
          </p>
        </div>
        {conversationId !== null && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setConversationId(null);
              setMessages([]);
              setError(undefined);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New conversation
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
        <div className="space-y-2">
          {isLoading ? (
            <ListSkeleton rows={2} />
          ) : (
            (conversations?.items ?? []).map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setConversationId(conversation.id);
                  setError(undefined);
                }}
                className={cn(
                  'block w-full rounded-card border p-3 text-left transition-colors',
                  conversation.id === conversationId
                    ? 'border-accent-700 bg-accent-50'
                    : 'border-border-subtle bg-surface hover:border-border-strong',
                )}
              >
                <p className="text-sm font-medium text-ink">
                  {formatDay(conversation.lastMessageAt)}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {formatTime(conversation.lastMessageAt)} · {conversation.status.toLowerCase()}
                </p>
              </button>
            ))
          )}
        </div>

        <Card className="flex h-[70vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {visible.length === 0 && !sending ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <MessageCircleQuestion className="size-8 text-ink-faint" aria-hidden />
                <div>
                  <p className="font-medium text-ink">How can we help?</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Rydex support can look up your own trips and bookings to answer.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={(event) => void submit(event, suggestion)}
                      className="rounded-full border border-border-strong px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent-700 hover:text-accent-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              visible.map((message) => {
                const mine = message.role === 'USER';
                return (
                  <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        mine ? 'bg-accent-700 text-white' : 'bg-slate-100 text-ink',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-ink-muted">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error !== undefined && (
            <div className="border-t border-border-subtle px-4 py-2">
              <InlineError error={error} />
            </div>
          )}

          <form
            onSubmit={(event) => void submit(event)}
            className="flex items-end gap-2 border-t border-border-subtle p-3"
          >
            <label className="sr-only" htmlFor="support-draft">
              Message
            </label>
            <textarea
              id="support-draft"
              rows={1}
              maxLength={SUPPORT_MAX_MESSAGE_LENGTH}
              disabled={rateLimited}
              placeholder={rateLimited ? 'Please wait a moment…' : 'Ask a question'}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit(event);
                }
              }}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-700 focus:outline-none disabled:bg-slate-50"
            />
            <Button type="submit" loading={sending} disabled={draft.trim().length === 0}>
              <Send className="size-4" aria-hidden />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
