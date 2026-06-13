import type {
  DocumentAccessAction,
  DocumentAccessDecision,
} from '@/lib/auth/permissions';
import type { ShareLinkPermission } from './share-links.types';

const VIEW_ONLY_DOWNLOAD_REASON = 'This share link allows view only.';

function isShareBypassableDenial(decision: DocumentAccessDecision): boolean {
  const reason = decision.reason ?? '';
  return (
    reason.includes('ACL') ||
    reason.includes('classification policy') ||
    reason.startsWith('INTERNAL documents require') ||
    reason.startsWith('CONFIDENTIAL documents require') ||
    reason.startsWith('SECRET documents require')
  );
}

export function applySharePermissionToDocumentDecision(
  decision: DocumentAccessDecision,
  action: DocumentAccessAction,
  permission?: ShareLinkPermission,
): DocumentAccessDecision {
  if (!permission || action === 'metadata' || decision.allowed) {
    return decision;
  }

  if (action === 'download' && permission === 'VIEW') {
    return { allowed: false, reason: VIEW_ONLY_DOWNLOAD_REASON };
  }

  if (!isShareBypassableDenial(decision)) {
    return decision;
  }

  if (action === 'preview' || permission === 'DOWNLOAD') {
    return { allowed: true };
  }

  return decision;
}
