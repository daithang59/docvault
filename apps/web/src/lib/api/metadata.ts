import {
  DocumentListItem,
  DocumentDetail,
  WorkflowHistoryEntry,
  AclEntry,
  DownloadAuthorizeRequest,
  DownloadAuthorizeResponse,
  CreateDocumentDto,
  UpdateDocumentDto,
  AddAclEntryDto,
} from '@/types/document';
import { apiGet, apiPost, apiPatch } from './client';

export function getDocuments(): Promise<DocumentListItem[]> {
  return apiGet<DocumentListItem[]>('/metadata/documents');
}

export function getDocumentDetail(docId: string): Promise<DocumentDetail> {
  return apiGet<DocumentDetail>(`/metadata/documents/${docId}`);
}

export function createDocument(data: CreateDocumentDto): Promise<DocumentListItem> {
  return apiPost<DocumentListItem>('/metadata/documents', data);
}

export function updateDocument(
  docId: string,
  data: UpdateDocumentDto
): Promise<DocumentListItem> {
  return apiPatch<DocumentListItem>(`/metadata/documents/${docId}`, data);
}

export function getWorkflowHistory(docId: string): Promise<WorkflowHistoryEntry[]> {
  return apiGet<WorkflowHistoryEntry[]>(
    `/metadata/documents/${docId}/workflow-history`
  );
}

export function getAcl(docId: string): Promise<AclEntry[]> {
  return apiGet<AclEntry[]>(`/metadata/documents/${docId}/acl`);
}

export function addAclEntry(
  docId: string,
  data: AddAclEntryDto
): Promise<AclEntry> {
  return apiPost<AclEntry>(`/metadata/documents/${docId}/acl`, data);
}

export function downloadAuthorize(
  docId: string,
  data?: DownloadAuthorizeRequest
): Promise<DownloadAuthorizeResponse> {
  return apiPost<DownloadAuthorizeResponse>(
    `/metadata/documents/${docId}/download-authorize`,
    data ?? {}
  );
}
