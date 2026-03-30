'use client';

import { WorkflowHistoryEntry } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { Send, CheckCircle, XCircle, Archive } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useAuth } from '@/lib/auth/auth-context';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';

const ACTION_CONFIG = {
  SUBMIT: { icon: Send, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--stat-total-bg)]', label: 'Submitted' },
  APPROVE: { icon: CheckCircle, color: 'text-[var(--status-published-text)]', bg: 'bg-[var(--stat-published-bg)]', label: 'Approved' },
  REJECT: { icon: XCircle, color: 'text-[var(--state-error-text)]', bg: 'bg-[var(--state-error-bg)]', label: 'Rejected' },
  ARCHIVE: { icon: Archive, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-muted)]', label: 'Archived' },
};

interface DocumentWorkflowTimelineProps {
  history: WorkflowHistoryEntry[];
}

export function DocumentWorkflowTimeline({ history }: DocumentWorkflowTimelineProps) {
  const { session } = useAuth();
  const currentSub = session?.user.sub;
  const actorIds = [...new Set(history.map((h) => h.actorId).filter(Boolean))];
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
