import type {
  DocumentStatus,
  ClassificationLevel,
  AclPermission,
  AclEffect,
  AclSubjectType,
} from '@/types/enums';
import type { PaginationParams } from '@/types/pagination';

// ── Document list item (returned by GET /metadata/documents) ─────────────────

export interface DocumentListItem {
  id: string;
  title: string;
  description?: string;
  status: DocumentStatus;
  classificationLevel: ClassificationLevel;
  classification?: ClassificationLevel;  // Phase 1 alias for classificationLevel
  ownerId: string;
  ownerDisplay?: string;
  currentVersionNumber?: number;
  currentVersion?: number;               // Phase 1 alias for currentVersionNumber
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  tags: string[];
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Document detail (GET /metadata/documents/:id) ────────────────────────────

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  filename: string;
  mimeType?: string;
  fileSize?: number;
  uploadedById: string;
  uploadedAt: string;
  storagePath?: string;
  // Phase 1 backward-compat aliases
  version?: number;           // alias for versionNumber
  size?: number;              // alias for fileSize
  checksum?: string;
  contentType?: string;       // alias for mimeType
  createdAt?: string;         // alias for uploadedAt
  createdBy?: string;         // alias for uploadedById
}

export interface WorkflowHistoryEntry {
  id: string;
  action: string;
  actorId: string;
  actorDisplay?: string;
  fromStatus?: DocumentStatus;
  toStatus: DocumentStatus;
  comment?: string;
  reason?: string;             // Phase 1 alias for comment
  createdAt: string;
}

export interface AclEntry {
  id: string;
  subjectType: AclSubjectType;
  subjectId: string;
  subjectDisplay?: string;
  permission: AclPermission;
  effect: AclEffect;
  createdAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  acl: AclEntry[];
  aclEntries?: AclEntry[];         // Phase 1 backward compat alias for acl
  versions: DocumentVersion[];
  workflowHistory: WorkflowHistoryEntry[];
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateDocumentDto {
  title: string;
  description?: string;
  classificationLevel: ClassificationLevel;
  tags?: string[];
}

export interface UpdateDocumentDto {
  title?: string;
  description?: string;
  classificationLevel?: ClassificationLevel;
  tags?: string[];
}

// ── List filters ──────────────────────────────────────────────────────────────

export interface DocumentListFilters extends PaginationParams {
  q?: string;
  status?: DocumentStatus;
  classificationLevel?: ClassificationLevel;
  ownerId?: string;
  tags?: string[];
}

// ── ACL DTO ──────────────────────────────────────────────────────────────────

export interface AddAclEntryDto {
  subjectType: AclSubjectType;
  subjectId: string;
  permission: AclPermission;
  effect: AclEffect;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export interface WorkflowActionDto {
  comment?: string;
}

// ── Download ─────────────────────────────────────────────────────────────────

export interface DownloadAuthorizationResult {
  downloadToken: string;
  expiresAt?: string;
}

export interface PresignedDownloadResult {
  url: string;
  filename: string;
  expiresAt?: string;
}
