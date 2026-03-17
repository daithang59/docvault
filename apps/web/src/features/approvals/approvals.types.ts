import type { DocumentListItem } from '@/features/documents/documents.types';
import type { PaginationParams } from '@/types/pagination';

/** Approval queue item — just pending documents */
export type ApprovalQueueItem = DocumentListItem;

export interface ApprovalQueueFilters extends PaginationParams {
  q?: string;
}
