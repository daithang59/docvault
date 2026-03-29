import { DocumentStatus, ClassificationLevel } from '@/types/document';
import { UserRole } from '@/types/auth';

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  DELETED: 'Deleted',
};

export const CLASSIFICATION_LABELS: Record<ClassificationLevel, string> = {
  PUBLIC: 'Public',
  INTERNAL: 'Internal',
  CONFIDENTIAL: 'Confidential',
  SECRET: 'Secret',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  approver: 'Approver',
  compliance_officer: 'Compliance',
  admin: 'Admin',
};

export const WORKFLOW_ACTION_LABELS = {
  SUBMIT: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  ARCHIVE: 'Archived',
  DELETE: 'Deleted',
} as const;

export const TOAST_MESSAGES = {
  DOCUMENT_CREATED: 'Document created successfully.',
  DOCUMENT_UPDATED: 'Document updated successfully.',
  VERSION_UPLOADED: 'Version uploaded successfully.',
  SUBMITTED: 'Document submitted for approval.',
  APPROVED: 'Document approved and published.',
  REJECTED: 'Document rejected.',
  ARCHIVED: 'Document archived.',
  ARCHIVE_UNAVAILABLE: 'Unable to archive this document.',
  DOWNLOAD_RESTRICTED: 'Only published documents can be downloaded.',
  ACL_UPDATED: 'Access control updated.',
  // 409 Conflict messages — business-specific
  CONFLICT_SUBMIT: 'Document is no longer in a submittable state.',
  CONFLICT_APPROVE: 'Document is no longer pending approval.',
  CONFLICT_REJECT: 'Document is no longer pending approval.',
  CONFLICT_ARCHIVE: 'Document cannot be archived in its current state.',
  CONFLICT_DELETE: 'Only documents in DRAFT status can be deleted.',
  CONFLICT_UPLOAD: 'Cannot upload a new version to a document in this state.',
  // Forbidden
  FORBIDDEN_DOWNLOAD: 'You do not have permission to download this document.',
  FORBIDDEN_ACTION: 'You do not have permission to perform this action.',
} as const;
