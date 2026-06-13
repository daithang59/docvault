'use client';

import type { WorkflowHistoryEntry } from '@/types/document';
import type { WorkflowAction } from '@/types/enums';
import type { Session } from '@/types/auth';
import { formatDateTime } from '@/lib/utils/date';
import {
  Send,
  CheckCircle,
  XCircle,
  Archive,
  Circle,
  Clock,
  ArrowRight,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useAuth } from '@/lib/auth/auth-context';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import {
  buildDocumentLifecycleTimeline,
  type DocumentLifecycleNextAction,
  type DocumentLifecycleStageState,
  type DocumentLifecycleTone,
} from '@/features/documents/document-detail-presentation';
import type { DocumentDetail } from '@/features/documents/documents.types';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import {
  canApproveDocument,
  canRejectDocument,
  canSubmitDocument,
  canViewAudit,
  canViewComplianceEvidencePacket,
} from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/constants/routes';

interface WorkflowActionConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

const ACTION_CONFIG: Record<WorkflowAction, WorkflowActionConfig> = {
  SUBMIT: { icon: Send, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--stat-total-bg)]', label: 'Submitted' },
  APPROVE: { icon: CheckCircle, color: 'text-[var(--status-published-text)]', bg: 'bg-[var(--stat-published-bg)]', label: 'Approved' },
  REJECT: { icon: XCircle, color: 'text-[var(--state-error-text)]', bg: 'bg-[var(--state-error-bg)]', label: 'Rejected' },
  ARCHIVE: { icon: Archive, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-muted)]', label: 'Archived' },
  RETENTION: { icon: Archive, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-muted)]', label: 'Retention archived' },
  DELETE: { icon: Trash2, color: 'text-[var(--state-error-text)]', bg: 'bg-[var(--state-error-bg)]', label: 'Deleted' },
};

interface DocumentWorkflowTimelineProps {
  history: WorkflowHistoryEntry[];
  document?: DocumentDetail;
}

export function DocumentWorkflowTimeline({
  history,
  document,
}: DocumentWorkflowTimelineProps) {
  const { session } = useAuth();
  const currentSub = session?.user.sub;
  const lifecycle = document
    ? buildDocumentLifecycleTimeline(document, history)
    : null;
  const actorIds = [
    ...new Set(
      [
        ...history.map((h) => h.actorId),
        ...(lifecycle?.stages.map((s) => s.actorId) ?? []),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: displayNames } = useOwnerDisplayNames(actorIds);
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Workflow Timeline</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{history.length} transition{history.length !== 1 ? 's' : ''}</p>
      </div>

      {lifecycle && (
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {lifecycle.stages.map((stage) => (
              <div
                key={stage.id}
                className={cn(
                  'min-h-[112px] rounded-lg border p-3',
                  lifecycleStageClass(stage.state),
                )}
              >
                <div className="flex items-center gap-2">
                  <LifecycleStageIcon state={stage.state} />
                  <p className="text-xs font-semibold text-[var(--text-main)]">
                    {stage.label}
                  </p>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
                  {stage.description}
                </p>
                {stage.timestamp && (
                  <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                    {formatDateTime(stage.timestamp)}
                  </p>
                )}
                {(() => {
                  const resolved =
                    (stage.actorId === currentSub && session?.user.displayName) ||
                    (stage.actorId && displayNames?.[stage.actorId]?.displayName) ||
                    stage.actorLabel;
                  return resolved ? (
                    <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]">
                      {resolved}
                    </p>
                  ) : null;
                })()}
              </div>
            ))}
          </div>

          {lifecycle.nextAction && (
            canOpenLifecycleAction(session, document, lifecycle.nextAction) ? (
              <Link
                href={lifecycle.nextAction.href}
                className={cn(
                  'mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-[var(--bg-muted)]',
                  lifecycleToneClass(lifecycle.nextAction.tone),
                )}
              >
                <LifecycleNextActionContent action={lifecycle.nextAction} />
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            ) : (
              <div
                className={cn(
                  'mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
                  lifecycleToneClass(lifecycle.nextAction.tone),
                )}
              >
                <LifecycleNextActionContent action={lifecycle.nextAction} />
                <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase opacity-70">
                  Role gated
                </span>
              </div>
            )
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="No workflow history"
          description="History will appear after the document is submitted."
          icon="list"
          className="py-8"
        />
      ) : (
        <div className="px-5 py-4">
          <div className="relative">
            {/* Vertical line */}
            {sorted.length > 1 && (
              <div className="absolute left-4 top-8 bottom-8 w-px" style={{ background: 'var(--border-soft)' }} />
            )}
            <div className="space-y-4">
              {sorted.map((entry, idx) => {
                const config = ACTION_CONFIG[entry.action as keyof typeof ACTION_CONFIG] ?? ACTION_CONFIG.SUBMIT;
                const Icon = config.icon;
                return (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Icon */}
                    <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center z-10 ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{config.label}</span>
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {entry.fromStatus} → {entry.toStatus}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>Latest</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span>
                          By{' '}
                          {entry.actorId === currentSub && session?.user.displayName ? (
                            <span className="font-medium text-[var(--text-main)]">{session.user.displayName}</span>
                          ) : (
                            <span className="font-medium">{displayNames?.[entry.actorId]?.displayName ?? entry.actorDisplay ?? entry.actorId}</span>
                          )}
                        </span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.reason && (
                        <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>&ldquo;{entry.reason}&rdquo;</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LifecycleNextActionContent({
  action,
}: {
  action: DocumentLifecycleNextAction;
}) {
  return (
    <span>
      <span className="block text-xs font-semibold">
        {action.label}
      </span>
      <span className="mt-0.5 block text-[11px] opacity-80">
        {action.description}
      </span>
    </span>
  );
}

function LifecycleStageIcon({ state }: { state: DocumentLifecycleStageState }) {
  if (state === 'complete') {
    return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  }
  if (state === 'current') {
    return <Clock className="h-4 w-4 text-amber-600" />;
  }
  return <Circle className="h-4 w-4 text-[var(--text-faint)]" />;
}

function lifecycleStageClass(state: DocumentLifecycleStageState): string {
  if (state === 'complete') {
    return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20';
  }
  if (state === 'current') {
    return 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20';
  }
  return 'border-[var(--border-soft)] bg-[var(--bg-muted)]/40';
}

function lifecycleToneClass(tone: DocumentLifecycleTone): string {
  if (tone === 'critical') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300';
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300';
}

function canOpenLifecycleAction(
  session: Session | null,
  document: DocumentDetail | undefined,
  action: DocumentLifecycleNextAction,
): boolean {
  if (!document) return false;

  if (action.href === ROUTES.DOCUMENT_EDIT(document.id)) {
    return canSubmitDocument(session, document);
  }
  if (action.href === ROUTES.APPROVALS) {
    return canApproveDocument(session, document) || canRejectDocument(session, document);
  }
  if (action.href === ROUTES.SECURITY || action.href === ROUTES.RETENTION) {
    return canViewAudit(session);
  }
  if (action.href === ROUTES.EVIDENCE) {
    return canViewComplianceEvidencePacket(session);
  }

  return true;
}
