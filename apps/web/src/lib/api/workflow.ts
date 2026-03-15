import { apiPost } from './client';

export function submitDocument(docId: string): Promise<void> {
  return apiPost<void>(`/workflow/${docId}/submit`);
}

export function approveDocument(docId: string): Promise<void> {
  return apiPost<void>(`/workflow/${docId}/approve`);
}

export function rejectDocument(docId: string, reason?: string): Promise<void> {
  return apiPost<void>(`/workflow/${docId}/reject`, { reason });
}

export function archiveDocument(docId: string): Promise<void> {
  return apiPost<void>(`/workflow/${docId}/archive`);
}
