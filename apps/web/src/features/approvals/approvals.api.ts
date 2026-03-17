import apiClient from '@/lib/api/client';
import { unwrap } from '@/lib/api/response';
import type { PaginatedResponse } from '@/types/pagination';
import type { ApprovalQueueItem, ApprovalQueueFilters } from './approvals.types';

/** Fetch pending documents (approval queue) */
export async function getApprovalQueue(
  filters?: ApprovalQueueFilters,
): Promise<PaginatedResponse<ApprovalQueueItem>> {
  const res = await apiClient.get('/metadata/documents', {
    params: { ...filters, status: 'PENDING' },
  });
  return unwrap(res);
}
