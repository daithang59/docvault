import type { ClassificationLevel } from '@/types/enums';
import type { DocumentListFilters } from './documents.types';

export const documentsKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsKeys.all, 'list'] as const,
  list: (filters?: DocumentListFilters) => [...documentsKeys.lists(), filters] as const,
  savedViews: () => [...documentsKeys.all, 'saved-views'] as const,
  details: () => [...documentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentsKeys.details(), id] as const,
  workflowHistory: (id: string) => [...documentsKeys.detail(id), 'workflow-history'] as const,
  acl: (id: string) => [...documentsKeys.detail(id), 'acl'] as const,
  complianceEvidencePacket: (id: string) => [...documentsKeys.detail(id), 'evidence-packet'] as const,
  aiGuardrails: (id: string) => [...documentsKeys.detail(id), 'ai-guardrails'] as const,
  accessImpact: (id: string, classification: ClassificationLevel) =>
    [...documentsKeys.detail(id), 'access-impact', classification] as const,
  versions: (id: string) => [...documentsKeys.detail(id), 'versions'] as const,
};
