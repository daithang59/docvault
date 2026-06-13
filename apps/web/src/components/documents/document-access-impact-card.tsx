'use client';

import { AlertTriangle, Check, Download, Eye, ShieldAlert } from 'lucide-react';
import type { DocumentAccessImpact } from '@/features/documents/documents.types';
import { cn } from '@/lib/utils/cn';

interface DocumentAccessImpactCardProps {
  impact?: DocumentAccessImpact;
  isLoading?: boolean;
  isError?: boolean;
}

export function DocumentAccessImpactCard({
  impact,
  isLoading = false,
  isError = false,
}: DocumentAccessImpactCardProps) {
  if (isLoading) {
    return (
      <CardShell>
        <Header subtitle="Checking classification policy impact..." />
      </CardShell>
    );
  }

  if (isError || !impact) {
    return (
      <CardShell>
        <Header subtitle="Access impact preview is unavailable." tone="warning" />
      </CardShell>
    );
  }

  const warnings = [
    impact.changes.accessExpanded ? 'Access expands' : null,
    impact.changes.accessReduced ? 'Access reduces' : null,
    impact.changes.watermarkReduced ? 'Watermark reduced' : null,
    impact.changes.dlpOverrideRequired ? 'DLP override required' : null,
  ].filter(Boolean);

  return (
    <CardShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header subtitle="Policy simulation for the selected classification." />
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
          <span>{impact.current.classification}</span>
          <span className="text-[var(--text-faint)]">to</span>
          <span>{impact.proposed.classification}</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <span
              key={warning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] px-2 py-1 text-xs font-medium text-[var(--status-pending-text)]"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {warning}
            </span>
          ))}
        </div>
      )}

      {impact.changes.warnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {impact.changes.warnings.map((warning) => (
            <p key={warning} className="text-xs text-[var(--text-muted)]">
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {impact.roleImpacts.map((roleImpact) => (
          <div key={roleImpact.role} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--text-strong)]">
                {roleImpact.role}
              </span>
              <div className="flex gap-2">
                <ImpactPill
                  icon={Eye}
                  label="Metadata"
                  current={roleImpact.metadata.current}
                  proposed={roleImpact.metadata.proposed}
                />
                <ImpactPill
                  icon={Download}
                  label="Download"
                  current={roleImpact.download.current}
                  proposed={roleImpact.download.proposed}
                />
              </div>
            </div>
            {roleImpact.notes.length > 0 && (
              <div className="mt-2 space-y-1">
                {roleImpact.notes.map((note) => (
                  <p key={note} className="text-xs text-[var(--text-muted)]">
                    {note}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {impact.guardrails.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {impact.guardrails.map((guardrail) => (
            <div key={guardrail} className="flex gap-2 text-xs text-[var(--text-faint)]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{guardrail}</span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border bg-[var(--bg-card)] p-4"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="access-impact-heading"
    >
      {children}
    </section>
  );
}

function Header({
  subtitle,
  tone = 'default',
}: {
  subtitle: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div>
      <h2
        id="access-impact-heading"
        className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]"
      >
        <ShieldAlert
          className={cn(
            'h-4 w-4',
            tone === 'warning' ? 'text-[var(--status-pending-text)]' : 'text-[var(--text-faint)]',
          )}
        />
        Access impact preview
      </h2>
      <p className="mt-1 text-xs text-[var(--text-faint)]">{subtitle}</p>
    </div>
  );
}

function ImpactPill({
  icon: Icon,
  label,
  current,
  proposed,
}: {
  icon: typeof Eye;
  label: string;
  current: boolean;
  proposed: boolean;
}) {
  const changed = current !== proposed;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium',
        changed
          ? 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]'
          : 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      <Check className={cn('h-3 w-3', proposed ? 'opacity-100' : 'opacity-25')} />
    </span>
  );
}
