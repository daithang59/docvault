import apiClient from '@/lib/api/client';
import { unwrap } from '@/lib/api/response';

export interface WorkflowActionDto {
  comment?: string;
}

export async function submitDocument(id: string, dto?: WorkflowActionDto): Promise<void> {
  await apiClient.post(`/workflow/${id}/submit`, dto ?? {});
}

export async function approveDocument(id: string, dto?: WorkflowActionDto): Promise<void> {
  await apiClient.post(`/workflow/${id}/approve`, dto ?? {});
}

export async function rejectDocument(id: string, dto?: WorkflowActionDto): Promise<void> {
  await apiClient.post(`/workflow/${id}/reject`, dto ?? {});
}

export async function archiveDocument(id: string, dto?: WorkflowActionDto): Promise<void> {
  await apiClient.post(`/workflow/${id}/archive`, dto ?? {});
}
