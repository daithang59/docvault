/**
 * Compatibility shim — re-exports canonical document types from features layer.
 * Phase 1 components can continue importing from here without modification.
 * @deprecated Prefer importing directly from @/features/documents/documents.types
 */
export type {
  DocumentListItem,
  DocumentDetail,
  DocumentVersion,
  WorkflowHistoryEntry,
  AclEntry,
  CreateDocumentDto,
  UpdateDocumentDto,
  AddAclEntryDto,
  DownloadAuthorizationResult as DownloadAuthorizeResponse,
  PresignedDownloadResult as PresignDownloadResponse,
  WorkflowActionDto,
} from '@/features/documents/documents.types';

// Aliases for old field names used in Phase 1 components
export type { DocumentStatus, ClassificationLevel } from '@/types/enums';

// Old ACL type aliases used by Phase 1 acl-card component
export type {
  AclSubjectType as SubjectType,
  AclPermission as Permission,
  AclEffect as Effect,
} from '@/types/enums';


// Keep old standalone types that don't have new equivalents
export interface DownloadAuthorizeRequest {
  version?: number;
}

export interface PresignDownloadRequest {
  grantToken: string;
  version?: number;
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
