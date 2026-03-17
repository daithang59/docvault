import type { AuditQueryFilters } from './audit.types';

export const auditKeys = {
  all: ['audit'] as const,
  queries: () => [...auditKeys.all, 'query'] as const,
  query: (filters?: AuditQueryFilters) => [...auditKeys.queries(), filters] as const,
};
