'use client';

import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { Eye } from 'lucide-react';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';

interface ApprovalsTableProps {
  data: DocumentListItem[];
  onReview: (doc: DocumentListItem) => void;
}

export function ApprovalsTable({ data, onReview }: ApprovalsTableProps) {
  const ownerIds = [...new Set(data.map((d) => d.ownerId))];
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
              <Th>Version</Th>
              <Th>Updated</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((doc) => {
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
                  <td className="px-4 py-3"><ClassificationBadge classification={doc.classificationLevel ?? doc.classification} /></td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{display}</td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--text-muted)]">v{doc.currentVersionNumber ?? doc.currentVersion}</td>
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
        <p className="text-xs text-[var(--text-faint)]">{data.length} pending document{data.length !== 1 ? 's' : ''}</p>
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
