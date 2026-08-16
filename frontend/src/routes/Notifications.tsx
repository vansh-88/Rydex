import { BellOff, Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { listNotifications, markNotificationRead } from '@/api/endpoints/notifications';
import { usePaginatedQuery } from '@/api/hooks';
import { invalidate } from '@/api/store';
import type { AppNotification, NotificationType } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatDeparture } from '@/lib/kolkataDate';

// `data` is a flat string map the backend attaches per notification type. The
// booking/ride ids in it are what make a notification actionable rather than
// just informational.
function linkFor(notification: AppNotification): string | null {
  const data = notification.data ?? {};
  if (typeof data.bookingId === 'string') return `/trips/${data.bookingId}`;
  if (typeof data.rideId === 'string') return `/rides/${data.rideId}`;
  return null;
}

const TONE_BY_TYPE: Partial<Record<NotificationType, string>> = {
  PAYMENT_FAILED: 'text-red-700',
  RIDE_CANCELLED: 'text-red-700',
  BOOKING_CANCELLED: 'text-red-700',
  PAYMENT_SUCCESS: 'text-emerald-700',
  BOOKING_CONFIRMED: 'text-emerald-700',
  REFUND_PROCESSED: 'text-emerald-700',
};

export function Notifications() {
  const [marking, setMarking] = useState(false);

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => listNotifications(cursor, signal),
    [],
  );

  const { items, error, isLoading, isLoadingMore, hasMore, loadMore, reload } = usePaginatedQuery(
    'notifications',
    fetchPage,
  );

  const unread = items.filter((notification) => notification.readAt === null);

  // There is no mark-all-read endpoint, so this is a loop over what is loaded.
  // Deliberately not silent about that: it only affects the notifications
  // currently on screen.
  async function markAllVisibleRead() {
    setMarking(true);
    try {
      await Promise.allSettled(
        unread.map((notification) => markNotificationRead(notification.id)),
      );
      invalidate('notifications');
      reload();
    } finally {
      setMarking(false);
    }
  }

  async function markOneRead(notification: AppNotification) {
    if (notification.readAt !== null) return;
    await markNotificationRead(notification.id).catch(() => undefined);
    invalidate('notifications');
  }

  if (isLoading) return <ListSkeleton rows={4} />;
  if (error !== undefined && items.length === 0) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
        {unread.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            loading={marking}
            onClick={() => void markAllVisibleRead()}
          >
            <Check className="size-4" aria-hidden />
            Mark these as read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing here yet"
          description="You'll be notified when a booking is confirmed, a ride changes, or a payment goes through."
        />
      ) : (
        <div className="space-y-2">
          {items.map((notification) => {
            const link = linkFor(notification);
            const isUnread = notification.readAt === null;

            const body = (
              <Card
                className={cn(
                  'p-4 transition-colors',
                  isUnread ? 'border-accent-200 bg-accent-50/40' : 'bg-surface',
                  link !== null && 'hover:border-border-strong',
                )}
              >
                <div className="flex items-start gap-3">
                  {isUnread && (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-700"
                      aria-label="Unread"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-medium',
                        TONE_BY_TYPE[notification.type] ?? 'text-ink',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">{notification.body}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {formatDeparture(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>
            );

            return link !== null ? (
              <Link
                key={notification.id}
                to={link}
                onClick={() => void markOneRead(notification)}
                className="block"
              >
                {body}
              </Link>
            ) : (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markOneRead(notification)}
                className="block w-full text-left"
              >
                {body}
              </button>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" loading={isLoadingMore} onClick={loadMore}>
                Show older
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
