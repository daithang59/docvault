import { AuditLogEntry, AuditQueryFilters } from '@/types/audit';
import { apiGet } from './client';

export function queryAudit(filters: AuditQueryFilters): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return apiGet<AuditLogEntry[]>(`/audit/query${qs ? `?${qs}` : ''}`);
}
