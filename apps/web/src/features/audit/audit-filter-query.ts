import type { AuditResult } from '@/types/enums';
import type { AuditActionGroup, AuditQueryFilters } from './audit.types';

const AUDIT_RESULTS: AuditResult[] = ['SUCCESS', 'DENY', 'ERROR', 'CONFLICT'];
const AUDIT_ACTION_GROUPS: AuditActionGroup[] = [
  'AUTHORIZED_CONTENT_ACCESS',
  'DESTRUCTIVE_ACTIVITY',
];

export function parseAuditFilterQuery(
  search: string | URLSearchParams,
): AuditQueryFilters {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  const result = params.get('result');
  const actionGroup = params.get('actionGroup');
  const filters: AuditQueryFilters = {};

  if (isAuditResult(result)) filters.result = result;
  setStringFilter(filters, 'action', params.get('action'));
  if (isAuditActionGroup(actionGroup)) filters.actionGroup = actionGroup;
  setStringFilter(filters, 'actorId', params.get('actorId'));
  setStringFilter(filters, 'resourceType', params.get('resourceType'));
  setStringFilter(filters, 'resourceId', params.get('resourceId'));
  setStringFilter(filters, 'documentId', params.get('documentId'));
  setStringFilter(filters, 'aclId', params.get('aclId'));
  setStringFilter(filters, 'recommendationId', params.get('recommendationId'));
  setStringFilter(filters, 'from', params.get('from'));
  setStringFilter(filters, 'to', params.get('to'));

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

function isAuditActionGroup(value: string | null): value is AuditActionGroup {
  return AUDIT_ACTION_GROUPS.includes(value as AuditActionGroup);
}
