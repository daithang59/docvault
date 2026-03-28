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
  CONFLICT_SUBMIT: 'Tài liệu không còn ở trạng thái có thể gửi duyệt.',
  CONFLICT_APPROVE: 'Tài liệu không còn chờ duyệt.',
  CONFLICT_REJECT: 'Tài liệu không còn chờ duyệt.',
  CONFLICT_ARCHIVE: 'Tài liệu không thể lưu trữ ở trạng thái hiện tại.',
  CONFLICT_DELETE: 'Chỉ tài liệu ở trạng thái DRAFT mới có thể xóa.',
  CONFLICT_UPLOAD: 'Không thể tải phiên bản mới lên tài liệu ở trạng thái này.',
  // Forbidden
  FORBIDDEN_DOWNLOAD: 'Bạn không có quyền tải tài liệu này.',
  FORBIDDEN_ACTION: 'Bạn không có quyền thực hiện thao tác này.',
} as const;
