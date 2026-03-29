// Global enums and literal union types for DocVault FE
// Single source of truth — import from here, not from individual type files

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';

export type AclPermission = 'READ' | 'DOWNLOAD' | 'WRITE' | 'APPROVE';

export type AclEffect = 'ALLOW' | 'DENY';

export type AclSubjectType = 'USER' | 'ROLE' | 'GROUP' | 'ALL';

export type UserRole =
  | 'viewer'
  | 'editor'
  | 'approver'
  | 'compliance_officer'
  | 'admin';

export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ARCHIVE' | 'DELETE';

export type AuditResult = 'SUCCESS' | 'DENY' | 'ERROR' | 'CONFLICT';

export type SortDirection = 'asc' | 'desc';
