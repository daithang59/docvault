import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { normalizePaginatedResponse, unwrap } from '@/lib/api/response';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  AuditChainStatus,
  AuditLogEntry,
  AuditQueryFilters,
  SealAuditChainRequest,
  SealAuditChainResponse,
  SecurityRecommendationWorkflowHistoryEntry,
  SecuritySummary,
  UpdateSecurityRecommendationWorkflowRequest,
} from './audit.types';

const DEFAULT_AUDIT_WINDOW_PAGE_SIZE = 100;
const DEFAULT_AUDIT_WINDOW_MAX_PAGES = 100;

export type AuditLogPageFetcher = (
  filters?: AuditQueryFilters,
  page?: number,
  pageSize?: number,
) => Promise<PaginatedResponse<AuditLogEntry>>;

export interface AuditLogWindowOptions {
  pageSize?: number;
  maxPages?: number;
  fetchPage?: AuditLogPageFetcher;
}

function toAuditQueryParams(
  filters?: AuditQueryFilters,
  page?: number,
  pageSize?: number,
) {
  if (!filters) return undefined;

  return {
    actorId: filters.actorId,
    actorIds: toCommaList(filters.actorIds),
    action: filters.action,
    actions: toCommaList(filters.actions),
    actionGroup: filters.actionGroup,
    resourceType: filters.resourceType ?? filters.targetType,
    resourceId: filters.resourceId ?? filters.targetId,
    documentId: filters.documentId,
    documentIds: toCommaList(filters.documentIds),
    aclId: filters.aclId,
    recommendationId: filters.recommendationId,
    recommendationIds: toCommaList(filters.recommendationIds),
    classifications: toCommaList(filters.classifications),
    result: filters.result,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
    page,
    pageSize,
  };
}

function toCommaList(values?: string[]): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined;
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
  page?: number,
  pageSize?: number,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const res = await apiClient.get(apiEndpoints.audit.query, {
    params: toAuditQueryParams(filters, page, pageSize),
  });

  const paginated = normalizePaginatedResponse<AuditLogEntry>(unwrap(res));
  return {
    ...paginated,
    data: paginated.data.map(normalizeAuditLogEntry),
  };
}

export async function queryAuditLogWindow(
  filters?: AuditQueryFilters,
  options: AuditLogWindowOptions = {},
): Promise<PaginatedResponse<AuditLogEntry>> {
  const pageSize = options.pageSize ?? DEFAULT_AUDIT_WINDOW_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_AUDIT_WINDOW_MAX_PAGES;
  const fetchPage = options.fetchPage ?? queryAuditLog;
  const data: AuditLogEntry[] = [];

  let page = 1;
  let total = 0;
  let totalPages = 1;

  while (page <= totalPages) {
    if (page > maxPages) {
      throw new Error(`Audit window exceeds ${maxPages} pages`);
    }

    const batch = await fetchPage(filters, page, pageSize);
    data.push(...batch.data);
    total = batch.total;
    totalPages = batch.totalPages;
    page += 1;
  }

  return {
    data,
    total,
    page: 1,
    pageSize,
    totalPages,
  };
}

export async function verifyAuditChain(): Promise<AuditChainStatus> {
  const res = await apiClient.get(apiEndpoints.audit.verifyChain);
  return unwrap(res) as AuditChainStatus;
}

export async function sealAuditChainAndStartEpoch(
  dto: SealAuditChainRequest,
): Promise<SealAuditChainResponse> {
  const res = await apiClient.post(apiEndpoints.audit.sealChainAndStartEpoch, dto);
  return unwrap(res) as SealAuditChainResponse;
}

export async function getSecuritySummary(): Promise<SecuritySummary> {
  const res = await apiClient.get(apiEndpoints.audit.securitySummary);
  return unwrap(res) as SecuritySummary;
}

export async function updateSecurityRecommendationWorkflow(
  id: string,
  dto: UpdateSecurityRecommendationWorkflowRequest,
): Promise<AuditLogEntry> {
  const res = await apiClient.patch(
    apiEndpoints.audit.securityRecommendationWorkflow(id),
    dto,
  );
  return unwrap(res) as AuditLogEntry;
}

export async function getSecurityRecommendationWorkflowHistory(
  id: string,
): Promise<SecurityRecommendationWorkflowHistoryEntry[]> {
  const res = await apiClient.get(
    apiEndpoints.audit.securityRecommendationWorkflowHistory(id),
  );
  return unwrap(res) as SecurityRecommendationWorkflowHistoryEntry[];
}
