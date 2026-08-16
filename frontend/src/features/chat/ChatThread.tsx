import { Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { listMessages } from '@/api/endpoints/chat';
import type { Message } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatDay, formatTime } from '@/lib/kolkataDate';

import { chatErrorCopy, getChatSocket, joinConversation, sendChatMessage } from './socket';

const MAX_MESSAGE_LENGTH = 2000;

interface ChatThreadProps {
  conversationId: string;
  counterpartName: string;
}

export function ChatThread({ conversationId, counterpartName }: ChatThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // History arrives newest-first from the API; a thread reads oldest-first.
  const loadHistory = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const page = await listMessages(conversationId, undefined, signal);
      if (signal.aborted) return;
      setMessages([...page.items].reverse());
      setError(null);
    } catch {
      if (!signal.aborted) setError('Could not load this conversation.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadHistory]);

  // Join the room and listen. Authorization is re-checked by the backend on
  // every join *and* every send, so joining is not a permission grant — it
  // only subscribes this socket to the room's broadcasts.
  useEffect(() => {
    const socket = getChatSocket();

    const onMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((current) =>
        // The server echoes to the sender too, and a reconnect can replay,
        // so identity is checked before appending.
        current.some((existing) => existing.id === message.id) ? current : [...current, message],
      );
    };

    socket.on('message', onMessage);

    const join = () => {
      joinConversation(conversationId).catch((caught: unknown) => {
        setError(chatErrorCopy(caught));
      });
    };

    join();
    // Rooms are per-connection, so a reconnect has to re-join.
    socket.on('connect', join);

    return () => {
      socket.off('message', onMessage);
      socket.off('connect', join);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0 || sending) return;

    setSending(true);
    setError(null);
    try {
      await sendChatMessage(conversationId, text);
      // Not appended here: the server broadcasts to the sender as well, and
      // the listener above adds it. Doing both would duplicate the message.
      setDraft('');
    } catch (caught) {
      setError(chatErrorCopy(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : messages.length === 0 ? (
          <EmptyState
            title={`No messages yet`}
            description={`Say hello to ${counterpartName} and agree where to meet.`}
            className="border-0"
          />
        ) : (
          messages.map((message, index) => {
            const mine = message.senderId === user?.id;
            const previous = messages[index - 1];
            const showDay =
              previous === undefined ||
              formatDay(previous.createdAt) !== formatDay(message.createdAt);

            return (
              <div key={message.id}>
                {showDay && (
                  <p className="my-3 text-center text-xs text-ink-faint">
                    {formatDay(message.createdAt)}
                  </p>
                )}
                <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                      mine ? 'bg-accent-700 text-white' : 'bg-slate-100 text-ink',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.message}</p>
                    <p
                      className={cn(
                        'mt-1 text-right text-[11px]',
                        mine ? 'text-accent-100' : 'text-ink-faint',
                      )}
                    >
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="flex items-end gap-2 border-t border-border-subtle p-3"
      >
        <label className="sr-only" htmlFor="chat-draft">
          Message
        </label>
        <textarea
          id="chat-draft"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={`Message ${counterpartName}`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line — the convention for
            // a chat box.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(event);
            }
          }}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-700 focus:outline-none"
        />
        <Button type="submit" loading={sending} disabled={draft.trim().length === 0}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Send</span>
        </Button>
      </form>

      {error !== null && (
        <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
