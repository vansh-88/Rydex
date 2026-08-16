import { Bell } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { listNotifications } from '@/api/endpoints/notifications';
import { useApiQuery } from '@/api/hooks';

// There is no unread-count endpoint, so the badge is derived from the first
// page of the list. That bounds it at one page — hence the "9+" cap rather
// than an exact number, which would be a promise the API cannot keep.
const MAX_BADGE = 9;

export function NotificationBell() {
  const { data } = useApiQuery(
    'notifications',
    useCallback((signal: AbortSignal) => listNotifications(undefined, signal), []),
    {
      // Notifications arrive by FCM push and are never delivered over the
      // socket, so a web client only learns about them by asking. Returning
      // to the tab is the natural moment to check.
      refetchOnWindowFocus: true,
      staleTime: 60_000,
    },
  );

  const unread = (data?.items ?? []).filter((notification) => notification.readAt === null).length;

  return (
    <Link
      to="/notifications"
      aria-label={
        unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'
      }
      className="relative rounded-md p-2 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent-700 px-1 text-[10px] font-medium leading-4 text-white"
        >
          {unread > MAX_BADGE ? `${String(MAX_BADGE)}+` : unread}
        </span>
      )}
    </Link>
  );
}
