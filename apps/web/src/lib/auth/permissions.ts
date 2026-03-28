/**
 * Centralized permission helpers.
 * All role/status-based UI decisions flow through these functions —
 * never hard-code role checks in components.
 */

import type { Session } from '@/types/auth';
import type { DocumentStatus } from '@/types/enums';
import { hasAnyRole, hasRole } from './roles';

interface DocumentContext {
  status: DocumentStatus;
  ownerId?: string;
}

// ── Document list / creation ──────────────────────────────────────────────────

export function canViewDocuments(session: Session | null): boolean {
  void session;
  return true; // All authenticated users
}

export function canViewDocumentDetail(session: Session | null): boolean {
  void session;
  return true; // All authenticated users can view detail (compliance_officer, viewer, etc.)
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
  if (doc.status !== 'DRAFT') return false;
  if (hasRole(session, 'editor') && doc.ownerId === session.user.sub) return true;
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
  return hasRole(session, 'editor') && doc.ownerId === session.user.sub;
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
  return hasRole(session, 'editor') && doc.ownerId === session.user.sub;
}

// ── Download / ACL / Audit ────────────────────────────────────────────────────

export function canDownloadDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (hasRole(session, 'compliance_officer')) return false; // can audit but not download
  return doc.status === 'PUBLISHED';
}

/**
 * Whether the current user can preview a document.
 * Unlike download, compliance_officer IS allowed to preview.
 */
export function canPreviewDocument(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  return doc.status === 'PUBLISHED';
}

export function canManageAcl(
  session: Session | null,
  doc: DocumentContext,
): boolean {
  if (!session) return false;
  if (hasRole(session, 'admin')) return true;
  if (hasRole(session, 'editor') && doc.ownerId === session.user.sub) return true;
  return false;
}

export function canReadAcl(session: Session | null): boolean {
  return hasAnyRole(session, ['editor', 'approver', 'compliance_officer', 'admin']);
}

export function canViewAudit(session: Session | null): boolean {
  return hasAnyRole(session, ['compliance_officer', 'admin']);
}

export function canViewApprovals(session: Session | null): boolean {
  return hasAnyRole(session, ['approver', 'admin']);
}
