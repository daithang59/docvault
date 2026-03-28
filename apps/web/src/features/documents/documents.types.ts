import type {
  DocumentStatus,
  ClassificationLevel,
  AclPermission,
  AclEffect,
  AclSubjectType,
  WorkflowAction,
} from '@/types/enums';
import type { PaginationParams } from '@/types/pagination';

export interface DocumentSummaryDto {
  id: string;
  title: string;
  description?: string | null;
  status: DocumentStatus;
  classification: ClassificationLevel;
  ownerId: string;
  ownerDisplay?: string;
  currentVersion: number;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  tags: string[];
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  classificationLevel?: ClassificationLevel;
  currentVersionNumber?: number;
}

export type DocumentListItem = DocumentSummaryDto;

export interface DocumentVersionDto {
  id: string;
  docId?: string;
  version: number;
  objectKey: string;
  checksum: string;
  size: number;
  filename: string;
  contentType?: string | null;
  createdAt: string;
  createdBy: string;
  versionNumber?: number;
  fileSize?: number;
  mimeType?: string | null;
  uploadedAt?: string;
  uploadedById?: string;
  storagePath?: string;
}

export type DocumentVersion = DocumentVersionDto;

export interface WorkflowHistoryItemDto {
  id: string;
  docId?: string;
  action: WorkflowAction;
  actorId: string;
  actorDisplay?: string;
  fromStatus: DocumentStatus;
  toStatus: DocumentStatus;
  reason?: string | null;
  createdAt: string;
  comment?: string | null;
}

export type WorkflowHistoryEntry = WorkflowHistoryItemDto;

export interface DocumentAclEntryDto {
  id: string;
  docId?: string;
  subjectType: AclSubjectType;
  subjectId?: string | null;
  subjectDisplay?: string;
  permission: AclPermission;
  effect: AclEffect;
  createdAt: string;
}

export type AclEntry = DocumentAclEntryDto;

export interface DocumentDetailDto extends DocumentSummaryDto {
  versions: DocumentVersionDto[];
  aclEntries: DocumentAclEntryDto[];
  acl?: DocumentAclEntryDto[];
  workflowHistory?: WorkflowHistoryItemDto[];
}

export type DocumentDetail = DocumentDetailDto;

export interface CreateDocumentRequest {
  title: string;
  description?: string;
  classification?: ClassificationLevel;
  tags?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  classification?: ClassificationLevel;
  tags?: string[];
}

export type CreateDocumentDto = CreateDocumentRequest;
export type UpdateDocumentDto = UpdateDocumentRequest;

export interface DocumentListFilters extends PaginationParams {
  q?: string;
  status?: DocumentStatus;
  classification?: ClassificationLevel;
  classificationLevel?: ClassificationLevel;
  ownerId?: string;
  tags?: string[];
}

export interface AddAclEntryDto {
  subjectType: AclSubjectType;
  subjectId?: string;
  permission: AclPermission;
  effect: AclEffect;
}

export interface UploadVersionResponse {
  id: string;
  docId: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  objectKey: string;
  contentType?: string | null;
  createdAt: string;
  createdBy: string;
}

export type SubmitDocumentRequest = Record<string, never>;

export type ApproveDocumentRequest = Record<string, never>;

export interface RejectDocumentRequest {
  reason?: string;
}

export type ArchiveDocumentRequest = Record<string, never>;

export interface DownloadAuthorizationResult {
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType?: string | null;
  expiresInSeconds: number;
  expiresAt: string;
  grantToken: string;
  downloadToken?: string;
}

export interface PresignedDownloadResult {
  url: string;
  docId?: string;
  version?: number;
  filename?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
}

export interface PreviewAuthorizationResult {
  docId: string;
  version: number;
  filename: string;
  contentType?: string | null;
  expiresInSeconds: number;
  expiresAt: string;
  grantToken: string;
}
