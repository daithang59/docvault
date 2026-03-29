/**
 * Backward-compat auth helpers for Phase 1 components.
 * New code should use @/lib/auth/permissions and @/lib/auth/roles directly.
 */
export {
  hasRole,
  hasAnyRole,
  extractRolesFromJwt,
} from './roles';

export {
  canCreateDocument,
  canViewDocuments,
  canViewDocumentDetail,
  canEditDocument,
  canSubmitDocument,
  canApproveDocument,
  canRejectDocument,
  canArchiveDocument,
  canDeleteDocument,
  canDownloadDocument,
  canPreviewDocument,
  canReadAcl,
  canViewAudit,
  canViewApprovals,
} from './permissions';

// ── Legacy single-arg wrappers ────────────────────────────────────────────────
import { canManageAcl as _canManageAcl } from './permissions';
import type { Session } from '@/features/auth/auth.types';

/**
 * @deprecated Use canManageAcl(session, doc) from @/lib/auth/permissions instead.
 * Single-arg overload kept for Phase 1 backward compat.
 */
export function canManageAcl(
  session: Session | null,
  doc?: { status: import('@/types/enums').DocumentStatus; ownerId?: string },
): boolean {
  if (!session) return false;
  if (!doc) {
    return session.user.roles.includes('editor') || session.user.roles.includes('admin');
  }

  return _canManageAcl(session, doc);
}

/** @deprecated Use canEditDocument(session, doc) instead */
export function canUploadVersion(
  session: Session | null,
  doc: { status: string; ownerId: string },
): boolean {
  return canEditDocument(session, doc as { status: import('@/types/enums').DocumentStatus; ownerId?: string });
}

// Direct re-import for use in canUploadVersion
import { canEditDocument } from './permissions';
