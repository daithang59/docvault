import { Session, UserRole } from '@/types/auth';
import { DocumentListItem } from '@/types/document';

export function hasRole(session: Session | null, role: UserRole): boolean {
  if (!session) return false;
  return session.roles.includes(role);
}

export function hasAnyRole(session: Session | null, roles: UserRole[]): boolean {
  if (!session) return false;
  return roles.some((r) => session.roles.includes(r));
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, 'admin');
}

export function isViewer(session: Session | null): boolean {
  return hasRole(session, 'viewer');
}

export function isEditor(session: Session | null): boolean {
  return hasRole(session, 'editor');
}

export function isApprover(session: Session | null): boolean {
  return hasRole(session, 'approver');
}

export function isComplianceOfficer(session: Session | null): boolean {
  return hasRole(session, 'compliance_officer');
}

export function canEditDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  if (!session) return false;
  if (isAdmin(session)) return true;
  if (isEditor(session) && session.userId === doc.ownerId) return true;
  return false;
}

export function canSubmitDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  if (!session) return false;
  if (doc.status !== 'DRAFT') return false;
  return canEditDocument(session, doc);
}

export function canApproveDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  if (!session) return false;
  if (doc.status !== 'PENDING') return false;
  return hasAnyRole(session, ['approver', 'admin']);
}

export function canRejectDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  return canApproveDocument(session, doc);
}

export function canArchiveDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  if (!session) return false;
  if (doc.status !== 'PUBLISHED') return false;
  return hasAnyRole(session, ['approver', 'admin']);
}

export function canDownloadDocument(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  if (!session) return false;
  // Compliance officer NEVER downloads
  if (isComplianceOfficer(session)) return false;
  // Generally allowed when PUBLISHED (backend will enforce final check)
  if (doc.status === 'PUBLISHED') return true;
  // Admin can try
  if (isAdmin(session)) return true;
  return false;
}

export function canManageAcl(session: Session | null): boolean {
  if (!session) return false;
  return hasAnyRole(session, ['editor', 'admin']);
}

export function canUploadVersion(
  session: Session | null,
  doc: DocumentListItem
): boolean {
  return canEditDocument(session, doc);
}
