import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { queryAudit } from '@/lib/api/audit';
import { AuditQueryFilters } from '@/types/audit';

export function useAuditQuery(filters: AuditQueryFilters) {
  return useQuery({
    queryKey: queryKeys.audit(filters as Record<string, unknown>),
    queryFn: () => queryAudit(filters),
  });
}
