'use client';

import Link from 'next/link';
import { Archive, AudioWaveform, ExternalLink, FileJson, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import { buildDocumentEvidenceLinks } from '@/features/documents/document-detail-presentation';

interface DocumentEvidenceLinksCardProps {
  document: DocumentDetail;
}

const ICONS: Record<string, LucideIcon> = {
  'Audit events': AudioWaveform,
  'Evidence Center': FileJson,
  'Retention records': Archive,
  'Security posture': ShieldAlert,
};

export function DocumentEvidenceLinksCard({
  document,
}: DocumentEvidenceLinksCardProps) {
  const links = buildDocumentEvidenceLinks(document);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-evidence-links-heading"
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <h2
          id="document-evidence-links-heading"
          className="text-sm font-semibold text-[var(--text-strong)]"
        >
          Evidence links
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Jump to metadata-only audit and compliance views.
        </p>
      </div>

      <div className="divide-y divide-[var(--border-soft)]">
        {links.map((link) => {
          const Icon = ICONS[link.label] ?? FileJson;

          return (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-muted)]"
            >
              <span className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--text-main)]">
                    {link.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">
                    {link.description}
                  </span>
                </span>
              </span>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
