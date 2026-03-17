import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { normalizePaginatedResponse, unwrap } from '@/lib/api/response';
import type { PaginatedResponse } from '@/types/pagination';
import type { AuditLogEntry, AuditQueryFilters } from './audit.types';

function toAuditQueryParams(filters?: AuditQueryFilters) {
  if (!filters) return undefined;

  return {
    actorId: filters.actorId,
    action: filters.action,
    resourceType: filters.resourceType ?? filters.targetType,
    resourceId: filters.resourceId ?? filters.targetId,
    result: filters.result,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
    limit: filters.limit ?? filters.pageSize,
  };
}

function normalizeAuditLogEntry(entry: AuditLogEntry): AuditLogEntry {
  return {
    ...entry,
    id: entry.eventId,
    targetType: entry.resourceType,
    targetId: entry.resourceId ?? undefined,
  };
}

export async function queryAuditLog(
  filters?: AuditQueryFilters,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const res = await apiClient.get<AuditLogEntry[]>(apiEndpoints.audit.query, {
    params: toAuditQueryParams(filters),
  });

  return normalizePaginatedResponse(unwrap(res).map(normalizeAuditLogEntry));
}
