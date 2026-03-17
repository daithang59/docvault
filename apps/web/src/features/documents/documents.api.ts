import apiClient from '@/lib/api/client';
import { unwrap } from '@/lib/api/response';
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
} from './documents.types';
import type { PaginatedResponse } from '@/types/pagination';

// ── Metadata service endpoints ────────────────────────────────────────────────

export async function getDocuments(
  filters?: DocumentListFilters,
): Promise<PaginatedResponse<DocumentListItem>> {
  const res = await apiClient.get('/metadata/documents', { params: filters });
  return unwrap(res);
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await apiClient.get(`/metadata/documents/${id}`);
  return unwrap(res);
}

export async function createDocument(dto: CreateDocumentDto): Promise<DocumentDetail> {
  const res = await apiClient.post('/metadata/documents', dto);
  return unwrap(res);
}

export async function updateDocument(id: string, dto: UpdateDocumentDto): Promise<DocumentDetail> {
  const res = await apiClient.patch(`/metadata/documents/${id}`, dto);
  return unwrap(res);
}

export async function getWorkflowHistory(id: string): Promise<WorkflowHistoryEntry[]> {
  const res = await apiClient.get(`/metadata/documents/${id}/workflow-history`);
  return unwrap(res);
}

export async function getDocumentAcl(id: string): Promise<AclEntry[]> {
  const res = await apiClient.get(`/metadata/documents/${id}/acl`);
  return unwrap(res);
}

export async function addAclEntry(id: string, dto: AddAclEntryDto): Promise<AclEntry> {
  const res = await apiClient.post(`/metadata/documents/${id}/acl`, dto);
  return unwrap(res);
}

export async function authorizeDownload(id: string): Promise<DownloadAuthorizationResult> {
  const res = await apiClient.post(`/metadata/documents/${id}/download-authorize`);
  return unwrap(res);
}

// ── Document service endpoints ────────────────────────────────────────────────

export async function uploadDocumentFile(id: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  await apiClient.post(`/documents/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function presignDownload(
  id: string,
  downloadToken: string,
): Promise<PresignedDownloadResult> {
  const res = await apiClient.post(`/documents/${id}/presign-download`, { downloadToken });
  return unwrap(res);
}
