import { DocumentStatus, ClassificationLevel } from '@/types/document';
import { UserRole } from '@/types/auth';

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
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
} as const;

export const TOAST_MESSAGES = {
  DOCUMENT_CREATED: 'Document created successfully.',
  DOCUMENT_UPDATED: 'Document updated successfully.',
  VERSION_UPLOADED: 'Version uploaded successfully.',
  SUBMITTED: 'Document submitted for approval.',
  APPROVED: 'Document approved and published.',
  REJECTED: 'Document rejected.',
  ARCHIVED: 'Document archived.',
  ARCHIVE_UNAVAILABLE: 'Archive endpoint is not available yet.',
  DOWNLOAD_RESTRICTED: 'Only published documents can be downloaded.',
  ACL_UPDATED: 'Access control updated.',
} as const;
