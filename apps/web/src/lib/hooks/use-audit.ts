import { useQuery } from '@tanstack/react-query';
import { auditKeys } from '@/features/audit/audit.keys';
import { queryAudit } from '@/lib/api/audit';
import { AuditQueryFilters } from '@/types/audit';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';

export function useAuditQuery(
  filters: AuditQueryFilters,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
) {
  return useQuery({
    queryKey: auditKeys.query({ ...filters, page, pageSize }),
    queryFn: () => queryAudit(filters, page, pageSize),
  });
}
