'use client';

import { DocumentDetail } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { useOwnerDisplayName } from '@/features/approvals/approvals.hooks';
import { User, Calendar, Tag } from 'lucide-react';

interface DocumentHeaderProps {
  doc: DocumentDetail;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  const { data: ownerDisplay } = useOwnerDisplayName(doc.ownerId);

  return (
    <div className="mb-6 rounded-2xl border bg-[var(--bg-card)] p-6" style={{ borderColor: 'var(--border-soft)' }}>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <StatusBadge status={doc.status} />
        <ClassificationBadge classification={doc.classification} />
        <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
          v{doc.currentVersion}
        </span>
      </div>

      <h1 className="mb-2 text-2xl font-semibold leading-tight text-[var(--text-strong)]">
        {doc.title}
      </h1>
      {doc.description && (
        <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">{doc.description}</p>
      )}

      {doc.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 text-xs text-[var(--color-primary)]"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4" style={{ borderColor: 'var(--border-soft)' }}>
        <MetaItem label="Owner" icon={User} value={ownerDisplay ?? '...'} />
        <MetaItem label="Created" icon={Calendar} value={formatDateTime(doc.createdAt)} />
        <MetaItem label="Updated" icon={Calendar} value={formatDateTime(doc.updatedAt)} />
        {doc.publishedAt && (
          <MetaItem label="Published" icon={Calendar} value={formatDateTime(doc.publishedAt)} />
        )}
        {doc.archivedAt && (
          <MetaItem label="Archived" icon={Calendar} value={formatDateTime(doc.archivedAt)} />
        )}
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-[var(--text-faint)]" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          {label}
        </span>
      </div>
      <p className="text-sm text-[var(--text-main)]">{value}</p>
    </div>
  );
}
