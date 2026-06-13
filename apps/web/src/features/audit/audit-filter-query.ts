import type { AuditResult } from '@/types/enums';
import type { AuditQueryFilters } from './audit.types';

const AUDIT_RESULTS: AuditResult[] = ['SUCCESS', 'DENY', 'ERROR', 'CONFLICT'];

export function parseAuditFilterQuery(
  search: string | URLSearchParams,
): AuditQueryFilters {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  const result = params.get('result');
  const filters: AuditQueryFilters = {};

  if (isAuditResult(result)) filters.result = result;
  setStringFilter(filters, 'action', params.get('action'));
  setStringFilter(filters, 'actorId', params.get('actorId'));
  setStringFilter(filters, 'resourceType', params.get('resourceType'));
  setStringFilter(filters, 'resourceId', params.get('resourceId'));
  setStringFilter(filters, 'documentId', params.get('documentId'));
  setStringFilter(filters, 'aclId', params.get('aclId'));
  setStringFilter(filters, 'recommendationId', params.get('recommendationId'));

  return filters;
}

function setStringFilter<K extends keyof AuditQueryFilters>(
  filters: AuditQueryFilters,
  key: K,
  value: string | null,
) {
  if (value) {
    filters[key] = value as AuditQueryFilters[K];
  }
}

function isAuditResult(value: string | null): value is AuditResult {
  return AUDIT_RESULTS.includes(value as AuditResult);
}
