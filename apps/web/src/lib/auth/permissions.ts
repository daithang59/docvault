/**
 * Centralized permission helpers.
 * All role/status-based UI decisions flow through these functions —
 * never hard-code role checks in components.
 */

import type { Session } from '@/types/auth';
import type {
  AclEffect,
  AclPermission,
  AclSubjectType,
  ClassificationLevel,
  DocumentStatus,
  UserRole,
} from '@/types/enums';
import { hasAnyRole, hasRole } from './roles';
import { normalizeGroups } from './token';

interface DocumentContext {
  status: DocumentStatus;
  ownerId?: string | null;
  classification?: ClassificationLevel;
  currentVersion?: number | null;
  versions?: Array<{ version?: number; versionNumber?: number }>;
  aclEntries?: AclContextEntry[];
  acl?: AclContextEntry[];
}

interface AclContextEntry {
  subjectType: AclSubjectType;
  subjectId?: string | null;
  permission: AclPermission;
  effect: AclEffect;
}

export type DocumentAccessAction = 'metadata' | 'preview' | 'download';

export interface DocumentAccessDecision {
  allowed: boolean;
  reason?: string;
}

function allow(): DocumentAccessDecision {
  return { allowed: true };
}

function deny(reason: string): DocumentAccessDecision {
  return { allowed: false, reason };
}

// ownerId is stored as sub (Keycloak UUID).
// Use sub for ownership checks.
function isOwner(session: Session | null, ownerId: string | null | undefined): boolean {
  return session?.user?.sub === ownerId;
}

function hasAnyUserRole(session: Session | null, roles: UserRole[]): boolean {
  return roles.some((role) => hasRole(session, role));
}

function getAclEntries(doc: DocumentContext): AclContextEntry[] {
  return doc.aclEntries ?? doc.acl ?? [];
}

function hasAclContext(doc: DocumentContext): boolean {
  return (
    Object.prototype.hasOwnProperty.call(doc, 'aclEntries') ||
    Object.prototype.hasOwnProperty.call(doc, 'acl')
  );
}

function isAclDependentDenial(reason: string): boolean {
  return (
    reason.includes('explicit READ ACL allow') ||
    reason.includes('explicit DOWNLOAD ACL allow') ||
    reason.includes('denied by classification policy')
  );
}

function matchesAcl(
  session: Session | null,
  doc: DocumentContext,
  permission: AclPermission,
  effect: AclEffect,
): boolean {
  if (!session) return false;

  const actorId = session.user.sub;
  const roles = session.user.roles;
  const groups = normalizeGroups(session.user.groups);

  return getAclEntries(doc).some((entry) => {
    if (entry.permission !== permission || entry.effect !== effect) {
      return false;
    }

    if (entry.subjectType === 'ALL') {
      return true;
    }

    if (entry.subjectType === 'USER') {
      return entry.subjectId === actorId;
    }

    if (entry.subjectType === 'ROLE') {
      return entry.subjectId ? roles.includes(entry.subjectId as UserRole) : false;
    }

    if (entry.subjectType === 'GROUP') {
      const normalizedSubject = normalizeGroups(entry.subjectId ? [entry.subjectId] : [])[0];
      return normalizedSubject ? groups.includes(normalizedSubject) : false;
    }

    return false;
  });
}

function hasDocumentVersion(doc: DocumentContext): boolean {
  if (typeof doc.currentVersion === 'number') {
    return doc.currentVersion > 0;
  }

  if (doc.versions) {
    return doc.versions.some((version) => (version.versionNumber ?? version.version ?? 0) > 0);
  }

  return true;
}

function getClassificationContentDecision(
  session: Session | null,
  doc: DocumentContext,
  permission: Extract<AclPermission, 'READ' | 'DOWNLOAD'>,
  options?: { approverBypassesClassification?: boolean; ownerBypassesClassification?: boolean },
): DocumentAccessDecision {
  const classification = doc.classification;
  if (!classification) return allow();

  if (hasRole(session, 'admin')) return allow();
  if (options?.approverBypassesClassification && hasRole(session, 'approver')) return allow();
  if (options?.ownerBypassesClassification && isOwner(session, doc.ownerId)) return allow();

  const explicitAllow = matchesAcl(session, doc, permission, 'ALLOW');

  switch (classification) {
    case 'PUBLIC':
      return allow();
    case 'INTERNAL':
      return hasAnyUserRole(session, ['viewer', 'editor', 'approver', 'admin'])
        ? allow()
        : deny('INTERNAL documents require at least the viewer role.');
    case 'CONFIDENTIAL':
      if (!hasAnyUserRole(session, ['editor', 'approver', 'admin'])) {
        return deny('CONFIDENTIAL documents require at least the editor role.');
      }
      return isOwner(session, doc.ownerId) || explicitAllow
        ? allow()
        : deny(`CONFIDENTIAL documents require ownership or explicit ${permission} ACL allow.`);
    case 'SECRET':
      if (!hasAnyUserRole(session, ['approver', 'admin'])) {
        return deny('SECRET documents require at least the approver role.');
      }
      return isOwner(session, doc.ownerId) || explicitAllow
        ? allow()
        : deny(`SECRET documents require ownership or explicit ${permission} ACL allow.`);
    default:
      return deny('Unknown classification level.');
  }
}

function getMetadataAccessDecision(
  session: Session | null,
  doc: DocumentContext,
): DocumentAccessDecision {
  if (!session) return deny('Authentication is required.');
  if (doc.status === 'DELETED') return deny('Document is deleted.');
  if (matchesAcl(session, doc, 'READ', 'DENY')) return deny('Metadata read denied by ACL.');
  if (hasRole(session, 'admin')) return allow();

  const explicitReadAllow = matchesAcl(session, doc, 'READ', 'ALLOW');
  if (isOwner(session, doc.ownerId) || explicitReadAllow) return allow();

  if (hasRole(session, 'compliance_officer')) {
    return ['PUBLISHED', 'ARCHIVED'].includes(doc.status)
      ? allow()
      : deny('Compliance officers can only read published or archived metadata.');
  }

  if (hasRole(session, 'approver')) {
    return ['PENDING', 'PUBLISHED', 'ARCHIVED'].includes(doc.status)
      ? allow()
      : deny('Approvers can only read pending, published, or archived metadata.');
  }

  if (!['PUBLISHED', 'ARCHIVED'].includes(doc.status)) {
    return deny('Only published or archived documents are readable by this user.');
  }

  if (!doc.classification || doc.classification === 'PUBLIC') return allow();
  if (doc.classification === 'INTERNAL' && hasAnyUserRole(session, ['viewer', 'editor'])) {
    return allow();
  }
  if (doc.classification === 'CONFIDENTIAL' && hasRole(session, 'editor') && explicitReadAllow) {
    return allow();
  }

  return deny('Metadata read denied by classification policy.');
}

function getDownloadAccessDecision(
  session: Session | null,
  doc: DocumentContext,
): DocumentAccessDecision {
  if (!session) return deny('Authentication is required.');
  if (hasRole(session, 'compliance_officer')) {
    return deny('Compliance officers cannot download file content.');
  }
  if (doc.status !== 'PUBLISHED') return deny('Only published documents can be downloaded.');
  if (!hasDocumentVersion(doc)) return deny('Document has no uploaded version.');
  if (matchesAcl(session, doc, 'DOWNLOAD', 'DENY')) return deny('Download denied by ACL.');

  return getClassificationContentDecision(session, doc, 'DOWNLOAD');
}

function getPreviewAccessDecision(
  session: Session | null,
  doc: DocumentContext,
): DocumentAccessDecision {
  if (!session) return deny('Authentication is required.');
  if (hasRole(session, 'compliance_officer')) {
    return deny('Compliance officers cannot preview file content.');
  }
  if (doc.status === 'DELETED') return deny('Deleted documents cannot be previewed.');
  if (!hasDocumentVersion(doc)) return deny('Document has no uploaded version.');
  if (matchesAcl(session, doc, 'READ', 'DENY')) return deny('Preview denied by ACL.');

  return getClassificationContentDecision(session, doc, 'READ', {
    approverBypassesClassification: true,
    ownerBypassesClassification: true,
  });
}

export function getDocumentAccessDecision(
  session: Session | null,
  doc: DocumentContext,
  action: DocumentAccessAction,
): DocumentAccessDecision {
  if (action === 'metadata') return getMetadataAccessDecision(session, doc);
  if (action === 'download') return getDownloadAccessDecision(session, doc);
  return getPreviewAccessDecision(session, doc);
}

export function getExplainableDocumentAccessDecision(
  session: Session | null,
  doc: DocumentContext,
  action: DocumentAccessAction,
): DocumentAccessDecision {
  const decision = getDocumentAccessDecision(session, doc, action);

  if (decision.allowed || !decision.reason || hasAclContext(doc)) {
    return decision;
  }

  if (isAclDependentDenial(decision.reason)) {
    return { allowed: false };
  }

  return decision;
}

// ── Document list / creation ──────────────────────────────────────────────────

export function canViewDocuments(session: Session | null): boolean {
  return Boolean(session);
}

export function canViewDocumentDetail(session: Session | null, doc?: DocumentContext): boolean {
  if (!session) return false;
  if (!doc) return true;
  return getDocumentAccessDecision(session, doc, 'metadata').allowed;
}

export function canCreateDocument(session: Session | null): boolean {
  return hasAnyRole(session, ['editor', 'admin']);
}

// ── Document editing ──────────────────────────────────────────────────────────

export function canEditDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (hasRole(session, 'admin')) return true;
  // Editor + owner can edit their document in any status (DRAFT, PUBLISHED, ARCHIVED, etc.)
  if (hasRole(session, 'editor') && isOwner(session, doc.ownerId)) return true;
  return false;
}

// ── Workflow actions ──────────────────────────────────────────────────────────

export function canSubmitDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (doc.status !== 'DRAFT') return false;
  if (hasRole(session, 'admin')) return true;
  return hasRole(session, 'editor') && isOwner(session, doc.ownerId);
}

export function canApproveDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (doc.status !== 'PENDING') return false;
  return hasAnyRole(session, ['approver', 'admin']);
}

export function canRejectDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (doc.status !== 'PENDING') return false;
  return hasAnyRole(session, ['approver', 'admin']);
}

export function canArchiveDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (doc.status !== 'PUBLISHED') return false;
  if (hasRole(session, 'admin')) return true;
  return hasRole(session, 'editor') && isOwner(session, doc.ownerId);
}

export function canDeleteDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (doc.status !== 'DRAFT') return false;
  if (hasRole(session, 'admin')) return true;
  return hasRole(session, 'editor') && isOwner(session, doc.ownerId);
}

// ── Download / ACL / Audit ────────────────────────────────────────────────────

export function canDownloadDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  return getDocumentAccessDecision(session, doc, 'download').allowed;
}

/**
 * Whether the current user can preview a document.
 * Preview is file content access, so compliance officers are always blocked.
 */
export function canPreviewDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  return getDocumentAccessDecision(session, doc, 'preview').allowed;
}

export function canManageAcl(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (hasRole(session, 'admin')) return true;
  if (hasRole(session, 'editor') && isOwner(session, doc.ownerId)) return true;
  return false;
}

export function canReadAcl(session: Session | null): boolean {
  return hasAnyRole(session, ['editor', 'approver', 'compliance_officer', 'admin']);
}

export function canViewAudit(session: Session | null): boolean {
  return hasAnyRole(session, ['compliance_officer', 'admin']);
}

export function canViewComplianceEvidencePacket(session: Session | null): boolean {
  return hasAnyRole(session, ['compliance_officer', 'admin']);
}

export function canManageLegalHold(session: Session | null): boolean {
  return hasAnyRole(session, ['admin']);
}

export function canViewApprovals(session: Session | null): boolean {
  return hasAnyRole(session, ['approver', 'admin']);
}
