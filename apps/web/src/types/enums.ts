// Global enums and literal union types for DocVault FE
// Single source of truth — import from here, not from individual type files

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';

export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';

export type AclPermission = 'READ' | 'WRITE' | 'DELETE' | 'APPROVE' | 'AUDIT' | 'SHARE';

export type AclEffect = 'ALLOW' | 'DENY';

export type AclSubjectType = 'USER' | 'ROLE' | 'GROUP';

export type UserRole =
  | 'viewer'
  | 'editor'
  | 'approver'
  | 'compliance_officer'
  | 'admin';

export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ARCHIVE';

export type AuditResult = 'SUCCESS' | 'FAILURE' | 'DENIED';

export type SortDirection = 'asc' | 'desc';
