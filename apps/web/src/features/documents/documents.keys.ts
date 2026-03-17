import type { DocumentListFilters } from './documents.types';

export const documentsKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsKeys.all, 'list'] as const,
  list: (filters?: DocumentListFilters) => [...documentsKeys.lists(), filters] as const,
  details: () => [...documentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentsKeys.details(), id] as const,
  workflowHistory: (id: string) => [...documentsKeys.detail(id), 'workflow-history'] as const,
  acl: (id: string) => [...documentsKeys.detail(id), 'acl'] as const,
  versions: (id: string) => [...documentsKeys.detail(id), 'versions'] as const,
};
