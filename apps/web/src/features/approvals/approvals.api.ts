import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { normalizePaginatedResponse, unwrap } from '@/lib/api/response';
import type { PaginatedResponse } from '@/types/pagination';
import type { ApprovalQueueItem, ApprovalQueueFilters } from './approvals.types';
import type { DocumentListItem } from '@/features/documents/documents.types';

function normalizeApprovalItem(document: DocumentListItem): ApprovalQueueItem {
  return {
    ...document,
    classificationLevel: document.classification,
    currentVersionNumber: document.currentVersion,
  };
}

/** Fetch pending documents (approval queue) */
export async function getApprovalQueue(
  filters?: ApprovalQueueFilters,
): Promise<PaginatedResponse<ApprovalQueueItem>> {
  const res = await apiClient.get<DocumentListItem[]>(apiEndpoints.metadata.documents.list);
  const pendingDocuments = unwrap(res)
    .filter((document) => document.status === 'PENDING')
    .filter((document) => {
      if (!filters?.q) return true;

      const query = filters.q.toLowerCase();
      return (
        document.title.toLowerCase().includes(query) ||
        document.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .map(normalizeApprovalItem);

  return normalizePaginatedResponse(pendingDocuments);
}
