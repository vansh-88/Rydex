import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { listConversations } from '@/api/endpoints/chat';
import { usePaginatedQuery } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ChatThread } from '@/features/chat/ChatThread';
import { disconnectChatSocket } from '@/features/chat/socket';
import { cn } from '@/lib/cn';
import { formatDay, formatTime } from '@/lib/kolkataDate';

// Two panes on desktop, one at a time on mobile. There is one conversation
// per (ride, passenger), so a driver carrying three passengers has three
// separate threads rather than a group chat.
export function Messages() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => listConversations(cursor, signal),
    [],
  );

  const { items, error, isLoading, isLoadingMore, hasMore, loadMore, reload } = usePaginatedQuery(
    'conversations',
    fetchPage,
  );

  // One socket for the whole feature; closed when the user leaves messaging
  // rather than kept open for the life of the tab.
  useEffect(() => () => {
    disconnectChatSocket();
  }, []);

  const active = items.find((conversation) => conversation.id === conversationId);

  if (isLoading) return <ListSkeleton rows={4} />;
  if (error !== undefined && items.length === 0) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No conversations yet"
        description="A conversation opens automatically when you book a seat, so you can agree pickup details with the driver."
        action={
          <Link to="/" className={buttonStyles()}>
            Find a ride
          </Link>
        }
        className="my-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Messages</h1>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* On mobile the list is hidden once a thread is open, so the two
            panes never compete for a narrow screen. */}
        <div className={cn('space-y-2', conversationId !== undefined && 'hidden lg:block')}>
          {items.map((conversation) => {
            const isActive = conversation.id === conversationId;
            const last = conversation.lastMessage;

            return (
              <Link
                key={conversation.id}
                to={`/messages/${conversation.id}`}
                className={cn(
                  'block rounded-card border p-3 transition-colors',
                  isActive
                    ? 'border-accent-700 bg-accent-50'
                    : 'border-border-subtle bg-surface hover:border-border-strong',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium text-ink">{conversation.counterpart.name}</p>
                  {last !== null && (
                    <span className="shrink-0 text-xs text-ink-faint">
                      {formatTime(last.createdAt)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {last === null ? (
                    <span className="text-ink-faint">No messages yet</span>
                  ) : (
                    <>
                      {last.senderId === user?.id && (
                        <span className="text-ink-faint">You: </span>
                      )}
                      {last.message}
                    </>
                  )}
                </p>
                {last !== null && (
                  <p className="mt-0.5 text-xs text-ink-faint">{formatDay(last.createdAt)}</p>
                )}
              </Link>
            );
          })}

          {hasMore && (
            <Button
              variant="secondary"
              size="sm"
              loading={isLoadingMore}
              onClick={loadMore}
              className="w-full"
            >
              Show older
            </Button>
          )}
        </div>

        {conversationId !== undefined ? (
          <Card className="flex h-[70vh] flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-subtle p-3">
              <button
                type="button"
                onClick={() => {
                  void navigate('/messages');
                }}
                aria-label="Back to conversations"
                className="rounded p-1 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink lg:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <p className="font-medium text-ink">{active?.counterpart.name ?? 'Conversation'}</p>
            </div>

            <div className="min-h-0 flex-1">
              <ChatThread
                conversationId={conversationId}
                counterpartName={active?.counterpart.name ?? 'them'}
              />
            </div>
          </Card>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              icon={MessagesSquare}
              title="Choose a conversation"
              description="Pick someone on the left to see your messages."
            />
          </div>
        )}
      </div>
    </div>
  );
}
