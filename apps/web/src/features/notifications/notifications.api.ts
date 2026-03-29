import apiClient from '@/lib/api/client';

export type NotifyType = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'DELETED';

export interface NotificationRecord {
  id:          string;
  type:        NotifyType;
  docId:       string;
  recipientId:  string;
  docTitle?:   string;
  reason?:     string;
  traceId?:    string;
  createdAt:   string;
  read:        boolean;
}

export interface NotificationPage {
  records: NotificationRecord[];
  total:   number;
  page:    number;
  pages:   number;
}

export interface MarkReadResponse {
  ok: boolean;
}

/** Paginated notification list. Defaults: page 1, limit 20. */
export async function fetchNotifications(
  page  = 1,
  limit = 20,
): Promise<NotificationPage> {
  const res = await apiClient.get<NotificationPage>('/notify', {
    params: { page, limit },
  });
  return res.data;
}

/** Lightweight — used by polling to update the badge without fetching all records. */
export async function fetchUnreadCount(): Promise<{ count: number }> {
  const res = await apiClient.get<{ count: number }>('/notify/unread-count');
  return res.data;
}

/** Mark a single notification as read. */
export async function markAsRead(id: string): Promise<MarkReadResponse> {
  const res = await apiClient.post<MarkReadResponse>(`/notify/${id}/read`);
  return res.data;
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead(): Promise<MarkReadResponse> {
  const res = await apiClient.post<MarkReadResponse>('/notify/mark-read');
  return res.data;
}
