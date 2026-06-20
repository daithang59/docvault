import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { normalizePaginatedResponse, unwrap } from '@/lib/api/response';
import type {
  DocumentListItem,
  DocumentDetail,
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentListFilters,
  AclEntry,
  AddAclEntryDto,
  WorkflowHistoryEntry,
  DownloadAuthorizationResult,
  PresignedDownloadResult,
  UploadVersionResponse,
  PreviewAuthorizationResult,
  ComplianceEvidencePacket,
  DocumentAiGuardrails,
  DocumentAccessImpact,
  DocumentAccessImpactRequest,
  LegalHoldRequest,
} from './documents.types';
import type { PaginatedResponse } from '@/types/pagination';
import { SENSITIVE_ACTION_PROOF_HEADER } from '@/features/security/sensitive-action';

interface SensitiveActionProofOptions {
  stepUpProof?: string;
}

function normalizeDocumentSummary(document: DocumentListItem): DocumentListItem {
  return document;
}

function normalizeDocumentAclEntry(entry: AclEntry): AclEntry {
  return {
    ...entry,
    subjectId: entry.subjectId ?? undefined,
  };
}

function normalizeWorkflowHistoryEntry(entry: WorkflowHistoryEntry): WorkflowHistoryEntry {
  return {
    ...entry,
    comment: entry.reason ?? undefined,
  };
}

function normalizeDocumentDetail(document: DocumentDetail): DocumentDetail {
  return {
    ...normalizeDocumentSummary(document),
    versions: (document.versions ?? []).map((version) => ({
      ...version,
      versionNumber: version.version,
      fileSize: version.size,
      mimeType: version.contentType ?? undefined,
      uploadedAt: version.createdAt,
      uploadedById: version.createdBy,
      storagePath: version.objectKey,
    })),
    aclEntries: (document.aclEntries ?? []).map(normalizeDocumentAclEntry),
    acl: (document.aclEntries ?? []).map(normalizeDocumentAclEntry),
  };
}

export async function getDocuments(
  filters?: DocumentListFilters,
): Promise<PaginatedResponse<DocumentListItem>> {
  // Pass search query to server for efficient full-text search
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  const url = params.toString()
    ? `${apiEndpoints.metadata.documents.list}?${params}`
    : apiEndpoints.metadata.documents.list;

  const res = await apiClient.get<DocumentListItem[]>(url);
  const normalized = unwrap(res).map(normalizeDocumentSummary);

  return normalizePaginatedResponse(
    normalized.filter((document) => {
      if (filters?.status && document.status !== filters.status) return false;
      if (filters?.ownerId && document.ownerId !== filters.ownerId) return false;
      if (filters?.classification && document.classification !== filters.classification) return false;
      if (filters?.tags?.length && !filters.tags.every((tag) => document.tags.includes(tag))) return false;

      return true;
    }),
  );
}

export async function getDocument(
  id: string,
  shareToken?: string,
): Promise<DocumentDetail> {
  const endpoint = apiEndpoints.metadata.documents.detail(id);
  const params = new URLSearchParams();
  if (shareToken) params.set('shareToken', shareToken);
  const url = params.toString() ? `${endpoint}?${params}` : endpoint;
  const res = await apiClient.get<DocumentDetail>(url);
  return normalizeDocumentDetail(unwrap(res));
}

export async function getComplianceEvidencePacket(
  id: string,
  options: SensitiveActionProofOptions = {},
): Promise<ComplianceEvidencePacket> {
  const res = await apiClient.get<ComplianceEvidencePacket>(
    apiEndpoints.metadata.documents.evidencePacket(id),
    options.stepUpProof
      ? {
          headers: {
            [SENSITIVE_ACTION_PROOF_HEADER]: options.stepUpProof,
          },
        }
      : undefined,
  );
  return unwrap(res);
}

export async function getDocumentAiGuardrails(id: string): Promise<DocumentAiGuardrails> {
  const res = await apiClient.get<DocumentAiGuardrails>(
    apiEndpoints.metadata.documents.aiGuardrails(id),
  );
  return unwrap(res);
}

export async function previewDocumentAccessImpact(
  id: string,
  dto: DocumentAccessImpactRequest,
): Promise<DocumentAccessImpact> {
  const res = await apiClient.post<DocumentAccessImpact>(
    apiEndpoints.metadata.documents.accessImpact(id),
    dto,
  );
  return unwrap(res);
}

export async function createDocument(dto: CreateDocumentDto): Promise<DocumentDetail> {
  const res = await apiClient.post<DocumentListItem>(apiEndpoints.metadata.documents.create, dto);
  return normalizeDocumentDetail({
    ...unwrap(res),
    versions: [],
    aclEntries: [],
  });
}

export async function updateDocument(id: string, dto: UpdateDocumentDto): Promise<DocumentDetail> {
  const res = await apiClient.patch<DocumentListItem>(apiEndpoints.metadata.documents.update(id), dto);
  return normalizeDocumentDetail({
    ...unwrap(res),
    versions: [],
    aclEntries: [],
  });
}

export async function setDocumentLegalHold(
  id: string,
  dto: LegalHoldRequest,
): Promise<DocumentDetail> {
  const res = await apiClient.post<DocumentListItem>(
    apiEndpoints.metadata.documents.legalHold(id),
    dto,
  );
  return normalizeDocumentDetail({
    ...unwrap(res),
    versions: [],
    aclEntries: [],
  });
}

export interface TrashEntry {
  docId: string;
  title: string;
  ownerId: string;
  classification: string;
  deletedAt: string | null;
  purgeAt: string | null;
  daysUntilPurge: number | null;
  recoverable: boolean;
}

export async function listTrash(): Promise<TrashEntry[]> {
  const res = await apiClient.get<TrashEntry[]>(apiEndpoints.metadata.documents.trash);
  return unwrap(res);
}

export async function restoreDocumentFromTrash(docId: string): Promise<void> {
  await apiClient.post(apiEndpoints.metadata.documents.restore(docId), {});
}

export async function restoreDocumentVersion(
  id: string,
  version: number,
): Promise<DocumentDetail> {
  const res = await apiClient.post<DocumentListItem>(
    apiEndpoints.metadata.documents.restoreVersion(id, version),
    {},
  );
  return normalizeDocumentDetail({
    ...unwrap(res),
    versions: [],
    aclEntries: [],
  });
}

export async function setApprovalChain(
  id: string,
  approvers: string[],
): Promise<DocumentDetail> {
  const res = await apiClient.post<DocumentListItem>(
    apiEndpoints.metadata.documents.approvalChain(id),
    { approvers },
  );
  return normalizeDocumentDetail({
    ...unwrap(res),
    versions: [],
    aclEntries: [],
  });
}

export async function getDocumentApprovers(id: string): Promise<string[]> {
  const res = await apiClient.get<{ userIds: string[] }>(
    apiEndpoints.metadata.documents.approvers(id),
  );
  return unwrap(res).userIds ?? [];
}

export async function getWorkflowHistory(id: string): Promise<WorkflowHistoryEntry[]> {
  const res = await apiClient.get<WorkflowHistoryEntry[]>(
    apiEndpoints.metadata.documents.workflowHistory(id),
  );
  return unwrap(res).map(normalizeWorkflowHistoryEntry);
}

export async function getDocumentAcl(id: string): Promise<AclEntry[]> {
  const res = await apiClient.get<AclEntry[]>(apiEndpoints.metadata.documents.acl(id));
  return unwrap(res).map(normalizeDocumentAclEntry);
}

export async function addAclEntry(id: string, dto: AddAclEntryDto): Promise<AclEntry> {
  const res = await apiClient.post<AclEntry>(apiEndpoints.metadata.documents.acl(id), dto);
  return normalizeDocumentAclEntry(unwrap(res));
}

export async function authorizeDownload(
  id: string,
  version?: number,
  shareToken?: string,
): Promise<DownloadAuthorizationResult> {
  const res = await apiClient.post<DownloadAuthorizationResult>(
    apiEndpoints.metadata.documents.downloadAuthorize(id),
    {
      ...(version ? { version } : {}),
      ...(shareToken ? { shareToken } : {}),
    },
  );
  const authorization = unwrap(res);

  return {
    ...authorization,
    downloadToken: authorization.grantToken,
  };
}

export async function uploadDocumentFile(id: string, file: File): Promise<UploadVersionResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<UploadVersionResponse>(apiEndpoints.documents.upload(id), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return unwrap(res);
}

export async function presignDownload(
  id: string,
  version?: number,
  grantToken?: string,
): Promise<PresignedDownloadResult> {
  const res = await apiClient.post<PresignedDownloadResult>(
    apiEndpoints.documents.presignDownload(id),
    { ...(version != null && { version }), ...(grantToken && { grantToken }) },
  );
  return unwrap(res);
}

export async function authorizePreview(
  id: string,
  version?: number,
  shareToken?: string,
): Promise<PreviewAuthorizationResult> {
  const res = await apiClient.post<PreviewAuthorizationResult>(
    apiEndpoints.documents.previewAuthorize(id),
    {
      ...(version ? { version } : {}),
      ...(shareToken ? { shareToken } : {}),
    },
  );
  return unwrap(res);
}
