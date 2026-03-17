import apiClient from '@/lib/api/client';
import { unwrap } from '@/lib/api/response';
import type { PaginatedResponse } from '@/types/pagination';
import type { AuditLogEntry, AuditQueryFilters } from './audit.types';

export async function queryAuditLog(
  filters?: AuditQueryFilters,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const res = await apiClient.get('/audit/query', { params: filters });
  return unwrap(res);
}
