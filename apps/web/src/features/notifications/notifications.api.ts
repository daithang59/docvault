import apiClient from '@/lib/api/client';

export type NotifyType = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface NotificationRecord {
  id: string;
  type: NotifyType;
  docId: string;
  actorId: string;
  reason?: string;
  traceId?: string;
  createdAt: string;
  read: boolean;
}

export interface MarkReadResponse {
  ok: boolean;
}

export async function fetchNotifications(): Promise<NotificationRecord[]> {
  const res = await apiClient.get<NotificationRecord[]>('/notify');
  return res.data;
}

export async function markAllNotificationsRead(): Promise<MarkReadResponse> {
  const res = await apiClient.post<MarkReadResponse>('/notify/mark-read');
  return res.data;
}
