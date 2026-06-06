'use client';

import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { Eye } from 'lucide-react';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import type { ApprovalQueueSlaRow } from '@/features/approvals/approval-sla';

interface ApprovalsTableProps {
  rows: ApprovalQueueSlaRow[];
  onReview: (doc: DocumentListItem) => void;
}

export function ApprovalsTable({ rows, onReview }: ApprovalsTableProps) {
  const ownerIds = [...new Set(rows.map((row) => row.document.ownerId))];
  const { data: displayNames } = useOwnerDisplayNames(ownerIds);

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-subtle)' }}>
              <Th>Title</Th>
              <Th>Classification</Th>
              <Th>Owner</Th>
              <Th>Assignment</Th>
              <Th>SLA</Th>
              <Th>Version</Th>
              <Th>Updated</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const doc = row.document;
              const sla = row.sla;
              const display = displayNames?.[doc.ownerId]?.displayName ?? doc.ownerId ?? 'Unknown';
              return (
                <tr
                  key={doc.id}
                  className="cursor-pointer border-b transition-colors hover:bg-[var(--bg-muted)]/35"
                  style={{ borderColor: 'var(--border-soft)' }}
                  onClick={() => onReview(doc)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[var(--text-main)]">{truncateEnd(doc.title, 55)}</p>
                    {doc.tags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {doc.tags.slice(0, 2).map((t) => (
                          <span key={t} className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{t}</span>
                        ))}
                        {doc.tags.length > 2 && <span className="text-[10px] text-[var(--text-faint)]">+{doc.tags.length - 2}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><ClassificationBadge classification={doc.classification} /></td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{display}</td>
                  <td className="px-4 py-3">
                    <p className="whitespace-nowrap text-sm font-medium text-[var(--text-main)]">
                      {sla.assignment.label}
                    </p>
                    <p className="mt-1 max-w-[190px] text-xs leading-4 text-[var(--text-muted)]">
                      {sla.assignment.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${slaBadgeClass(sla.tone)}`}>
                      {sla.stateLabel}
                    </span>
                    <p className="mt-1 whitespace-nowrap text-[11px] text-[var(--text-faint)]">
                      Due {formatDateTime(sla.dueAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--text-muted)]">v{doc.currentVersion}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{formatDateTime(doc.updatedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onReview(doc); }}
                      className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t bg-[var(--bg-subtle)] px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <p className="text-xs text-[var(--text-faint)]">{rows.length} pending document{rows.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </th>
  );
}

function slaBadgeClass(tone: ApprovalQueueSlaRow['sla']['tone']): string {
  if (tone === 'danger') {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  }

  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }

  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
}
