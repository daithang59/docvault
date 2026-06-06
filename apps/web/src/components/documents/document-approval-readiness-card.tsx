'use client';

import { AlertTriangle, CheckCircle, CircleAlert, Clock } from 'lucide-react';
import type { DocumentDetail, DocumentListItem } from '@/features/documents/documents.types';
import {
  buildDocumentApprovalReadiness,
  type ApprovalReadinessItemState,
} from '@/features/documents/document-approval-readiness';
import { cn } from '@/lib/utils/cn';

interface DocumentApprovalReadinessCardProps {
  document: DocumentDetail | DocumentListItem;
  compact?: boolean;
}

const STATE_STYLE: Record<
  ApprovalReadinessItemState,
  { icon: typeof CheckCircle; color: string; bg: string; border: string }
> = {
  complete: {
    icon: CheckCircle,
    color: 'var(--status-published-text)',
    bg: 'var(--status-published-bg)',
    border: 'var(--status-published-border)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--status-pending-text)',
    bg: 'var(--status-pending-bg)',
    border: 'var(--status-pending-border)',
  },
  blocked: {
    icon: CircleAlert,
    color: 'var(--state-error-text)',
    bg: 'var(--state-error-bg)',
    border: 'var(--state-error-border)',
  },
};

export function DocumentApprovalReadinessCard({
  document,
  compact = false,
}: DocumentApprovalReadinessCardProps) {
  const readiness = buildDocumentApprovalReadiness(document);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-approval-readiness-heading"
    >
      <div
        className={cn(
          'border-b px-4',
          compact ? 'py-3' : 'py-4',
        )}
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="document-approval-readiness-heading"
              className="text-sm font-semibold text-[var(--text-strong)]"
            >
              Approval readiness
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {readiness.summary}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold"
            style={{
              color:
                readiness.status === 'ready'
                  ? 'var(--status-published-text)'
                  : readiness.status === 'blocked'
                    ? 'var(--state-error-text)'
                    : 'var(--status-pending-text)',
              background:
                readiness.status === 'ready'
                  ? 'var(--status-published-bg)'
                  : readiness.status === 'blocked'
                    ? 'var(--state-error-bg)'
                    : 'var(--status-pending-bg)',
              borderColor:
                readiness.status === 'ready'
                  ? 'var(--status-published-border)'
                  : readiness.status === 'blocked'
                    ? 'var(--state-error-border)'
                    : 'var(--status-pending-border)',
            }}
          >
            <Clock className="h-3.5 w-3.5" />
            {readiness.label}
          </span>
        </div>
      </div>

      <div className={cn('divide-y divide-[var(--border-soft)]', compact && 'text-sm')}>
        {readiness.items.map((item) => {
          const style = STATE_STYLE[item.state];
          const Icon = style.icon;

          return (
            <div key={item.key} className="flex gap-3 px-4 py-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  color: style.color,
                  background: style.bg,
                  borderColor: style.border,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text-main)]">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                  {item.detail}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
