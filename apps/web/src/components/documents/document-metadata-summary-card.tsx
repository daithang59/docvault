'use client';

import {
  Archive,
  Calendar,
  CheckCircle,
  FileText,
  Fingerprint,
  Shield,
  Tag,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import {
  buildDocumentMetadataSummary,
  type DocumentMetadataKind,
} from '@/features/documents/document-detail-presentation';
import { useOwnerDisplayName } from '@/features/approvals/approvals.hooks';

interface DocumentMetadataSummaryCardProps {
  document: DocumentDetail;
}

const ICONS: Record<DocumentMetadataKind, LucideIcon> = {
  identity: User,
  status: CheckCircle,
  classification: Shield,
  retention: Archive,
  version: Tag,
  checksum: Fingerprint,
  file: FileText,
  date: Calendar,
};

export function DocumentMetadataSummaryCard({
  document,
}: DocumentMetadataSummaryCardProps) {
  const { data: ownerDisplay } = useOwnerDisplayName(document.ownerId);
  const items = buildDocumentMetadataSummary(document).map((item) =>
    item.kind === 'identity' && ownerDisplay
      ? { ...item, value: ownerDisplay }
      : item,
  );

  return (
    <section
      className="rounded-lg border bg-[var(--bg-card)] p-4"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-metadata-summary-heading"
    >
      <div className="mb-3">
        <h2
          id="document-metadata-summary-heading"
          className="text-sm font-semibold text-[var(--text-strong)]"
        >
          Metadata summary
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Operational fields for quick inspection.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = ICONS[item.kind];

          return (
            <div
              key={item.label}
              className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)]/35 px-3 py-2"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase text-[var(--text-faint)]">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </div>
              <p className="break-words text-sm font-medium text-[var(--text-main)]">
                {item.value}
              </p>
              {item.detail ? (
                <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
                  {item.detail}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
