import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { queryAudit } from '@/lib/api/audit';
import { AuditQueryFilters } from '@/types/audit';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';

export function useAuditQuery(
  filters: AuditQueryFilters,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
) {
  return useQuery({
    queryKey: queryKeys.audit({ ...filters, page, pageSize }),
    queryFn: () => queryAudit(filters, page, pageSize),
  });
}
