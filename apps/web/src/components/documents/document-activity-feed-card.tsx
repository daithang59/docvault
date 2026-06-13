'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, GitBranch, MessageSquare, ShieldCheck } from 'lucide-react';
import { getWorkflowHistory } from '@/features/documents/documents.api';
import { documentsKeys } from '@/features/documents/documents.keys';
import { queryAuditLog } from '@/features/audit/audit.api';
import { useComments } from '@/lib/hooks/use-comments';
import {
  buildActivityFeed,
  type ActivityKind,
} from '@/features/documents/activity-feed';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/permissions';
import { formatDateTime } from '@/lib/utils/date';

interface DocumentActivityFeedCardProps {
  docId: string;
}

const KIND_ICON: Record<ActivityKind, typeof Activity> = {
  workflow: GitBranch,
  comment: MessageSquare,
  audit: ShieldCheck,
};

const KIND_TONE: Record<ActivityKind, string> = {
  workflow: 'text-[var(--color-primary)]',
  comment: 'text-[var(--status-published-text)]',
  audit: 'text-[var(--text-muted)]',
};

export function DocumentActivityFeedCard({ docId }: DocumentActivityFeedCardProps) {
  const { session } = useAuth();
  const canAudit = canViewAudit(session);

  const workflowQuery = useQuery({
    queryKey: documentsKeys.workflowHistory(docId),
    queryFn: () => getWorkflowHistory(docId),
    enabled: Boolean(docId),
  });
  const commentsQuery = useComments(docId);
  const auditQuery = useQuery({
    queryKey: [...documentsKeys.detail(docId), 'activity-audit'] as const,
    queryFn: () => queryAuditLog({ documentId: docId }, 1, 50),
    enabled: Boolean(docId) && canAudit,
  });

  const feed = useMemo(
    () =>
      buildActivityFeed({
        workflowHistory: workflowQuery.data ?? [],
        comments: commentsQuery.data ?? [],
        auditEvents: auditQuery.data?.data ?? [],
      }),
    [workflowQuery.data, commentsQuery.data, auditQuery.data],
  );

  const actorIds = useMemo(
    () => [...new Set(feed.map((event) => event.actorId).filter(Boolean))],
    [feed],
  );
  const { data: displayNames } = useOwnerDisplayNames(actorIds);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-activity-heading"
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <h2
          id="document-activity-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]"
        >
          <Activity className="h-4 w-4 text-[var(--color-primary)]" />
          Activity
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Unified timeline of workflow, comments{canAudit ? ', and audit events' : ''}.
        </p>
      </div>

      <div className="p-4">
        {feed.length === 0 ? (
          <p className="py-3 text-xs text-[var(--text-faint)]">No activity yet.</p>
        ) : (
          <ol className="space-y-3">
            {feed.map((event) => {
              const Icon = KIND_ICON[event.kind];
              const actor =
                displayNames?.[event.actorId]?.displayName ?? event.actorId;
              return (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] ${KIND_TONE[event.kind]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-main)]">
                      <span className="font-medium">{actor}</span>{' '}
                      <span className="text-[var(--text-muted)]">{event.title.toLowerCase()}</span>
                    </p>
                    {event.detail && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {event.detail}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                      {formatDateTime(event.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
