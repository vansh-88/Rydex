import { apiRequest, withQuery } from '@/api/client';
import type { AppNotification, Paginated } from '@/api/types';

export function listNotifications(
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<AppNotification>> {
  return apiRequest(withQuery('/notifications', { cursor }), { signal });
}

// Idempotent — marking an already-read notification is a no-op, not an error.
// There is no mark-all-read endpoint, so "mark all" is a loop over the page.
export function markNotificationRead(notificationId: string): Promise<AppNotification> {
  return apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}
