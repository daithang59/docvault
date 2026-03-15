// Document domain types for DocVault

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
export type SubjectType = 'USER' | 'ROLE' | 'GROUP' | 'ALL';
export type Permission = 'READ' | 'DOWNLOAD' | 'WRITE' | 'APPROVE';
export type Effect = 'ALLOW' | 'DENY';
export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ARCHIVE';

export interface DocumentListItem {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  classification: ClassificationLevel;
  tags: string[];
  status: DocumentStatus;
  currentVersion: number;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  docId: string;
  version: number;
  objectKey: string;
  checksum: string;
  size: number;
  filename: string;
  contentType: string | null;
  createdAt: string;
  createdBy: string;
}

export interface AclEntry {
  id: string;
  docId: string;
  subjectType: SubjectType;
  subjectId: string | null;
  permission: Permission;
  effect: Effect;
  createdAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersion[];
  aclEntries: AclEntry[];
}

export interface WorkflowHistoryEntry {
  id: string;
  docId: string;
  fromStatus: 'DRAFT' | 'PENDING' | 'PUBLISHED';
  toStatus: 'PENDING' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT';
  action: WorkflowAction;
  actorId: string;
  reason: string | null;
  createdAt: string;
}

export interface DownloadAuthorizeRequest {
  version?: number;
}

export interface DownloadAuthorizeResponse {
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType: string | null;
  expiresInSeconds: number;
  expiresAt: string;
  grantToken: string;
}

export interface PresignDownloadRequest {
  grantToken: string;
  version?: number;
}

export interface PresignDownloadResponse {
  url: string;
  expiresAt: string;
}

export interface UploadDocumentResponse {
  docId: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  objectKey: string;
  contentType: string;
}

export interface CreateDocumentDto {
  title: string;
  description?: string;
  classification: ClassificationLevel;
  tags: string[];
}

export interface UpdateDocumentDto {
  title?: string;
  description?: string;
  classification?: ClassificationLevel;
  tags?: string[];
}

export interface AddAclEntryDto {
  subjectType: SubjectType;
  subjectId?: string;
  permission: Permission;
  effect: Effect;
}
