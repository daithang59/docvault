import type { AuditLogEntry } from '@/features/audit/audit.types';
import type { WorkflowHistoryEntry } from './documents.types';
import type { DocumentComment } from '@/lib/hooks/use-comments';

export type ActivityKind = 'workflow' | 'comment' | 'audit';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  timestamp: string;
  actorId: string;
  title: string;
  detail?: string;
}

const WORKFLOW_LABELS: Record<string, string> = {
  SUBMIT: 'Submitted for approval',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  ARCHIVE: 'Archived',
  DELETE: 'Deleted',
  RETENTION: 'Auto-archived by retention',
};

// Audit actions already surfaced by the workflow timeline or comment list, so
// they would duplicate other feed entries if included again.
const REDUNDANT_AUDIT_ACTIONS = new Set([
  'DOCUMENT_SUBMITTED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'DOCUMENT_ARCHIVED',
  'DOCUMENT_COMMENT_ADDED',
]);

function humanizeAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function timeValue(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Merge workflow history, comments, and (optional) audit events into a single
 * reverse-chronological activity feed for a document.
 *
 * Audit entries that merely duplicate workflow/comment activity are filtered
 * out so the feed reads as one coherent story rather than a doubled log.
 */
export function buildActivityFeed(input: {
  workflowHistory?: WorkflowHistoryEntry[];
  comments?: DocumentComment[];
  auditEvents?: AuditLogEntry[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const entry of input.workflowHistory ?? []) {
    events.push({
      id: `workflow-${entry.id}`,
      kind: 'workflow',
      timestamp: entry.createdAt,
      actorId: entry.actorId,
      title: WORKFLOW_LABELS[entry.action] ?? humanizeAuditAction(entry.action),
      detail: entry.reason ?? entry.comment ?? undefined,
    });
  }

  for (const comment of input.comments ?? []) {
    events.push({
      id: `comment-${comment.id}`,
      kind: 'comment',
      timestamp: comment.createdAt,
      actorId: comment.authorId,
      title: 'Commented',
      detail: comment.content,
    });
  }

  for (const event of input.auditEvents ?? []) {
    if (REDUNDANT_AUDIT_ACTIONS.has(event.action)) continue;
    events.push({
      id: `audit-${event.eventId ?? event.id ?? event.timestamp}`,
      kind: 'audit',
      timestamp: event.timestamp,
      actorId: event.actorId,
      title: humanizeAuditAction(event.action),
      detail: event.reason ?? undefined,
    });
  }

  return events.sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp));
}
