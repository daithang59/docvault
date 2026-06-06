'use client';

import { Bot, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  DocumentAiDeniedOperation,
  DocumentAiGuardrails,
  DocumentAiOperation,
} from '@/features/documents/documents.types';

interface DocumentAiGuardrailsCardProps {
  guardrails?: DocumentAiGuardrails;
  isLoading?: boolean;
  isError?: boolean;
}

const OPERATION_LABELS: Record<DocumentAiOperation, string> = {
  METADATA_CLASSIFICATION: 'Metadata classification',
  METADATA_TAGGING: 'Metadata tagging',
  CONTENT_SUMMARIZATION: 'Content summarization',
  CONTENT_QA: 'Content Q&A',
};

export function DocumentAiGuardrailsCard({
  guardrails,
  isLoading = false,
  isError = false,
}: DocumentAiGuardrailsCardProps) {
  if (isLoading) {
    return (
      <CardShell>
        <Header
          label="Loading policy"
          description="Checking AI access boundaries for this document."
        />
      </CardShell>
    );
  }

  if (isError || !guardrails) {
    return (
      <CardShell>
        <Header
          label="Policy unavailable"
          description="AI guardrails could not be loaded for this document."
          tone="warning"
        />
      </CardShell>
    );
  }

  const modeLabel = guardrails.canUseContent ? 'Metadata and content' : 'Metadata only';
  const deniedContent = guardrails.deniedOperations.filter((entry) =>
    entry.operation.startsWith('CONTENT_'),
  );

  return (
    <CardShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header
          label={modeLabel}
          description="AI-ready policy context for classification, tagging, summarization, and Q&A."
          tone={guardrails.canUseContent ? 'ok' : 'warning'}
        />
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
          {guardrails.classification} / {guardrails.status}
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2" style={{ borderColor: 'var(--border-soft)' }}>
        <OperationGroup
          title="Allowed operations"
          operations={guardrails.allowedOperations}
        />
        <DeniedOperationGroup operations={deniedContent} />
      </div>

      <div className="mt-4 space-y-2">
        {guardrails.guardrails.map((rule) => (
          <div key={rule} className="flex gap-2 text-xs text-[var(--text-muted)]">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border bg-[var(--bg-card)] p-5"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="ai-guardrails-heading"
    >
      {children}
    </section>
  );
}

function Header({
  label,
  description,
  tone = 'ok',
}: {
  label: string;
  description: string;
  tone?: 'ok' | 'warning';
}) {
  const Icon = tone === 'ok' ? ShieldCheck : ShieldAlert;
  const badgeClassName =
    tone === 'ok'
      ? 'border-[var(--status-published-border)] bg-[var(--status-published-bg)] text-[var(--status-published-text)]'
      : 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]';

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Bot className="h-4 w-4 text-[var(--text-faint)]" />
        <h2 id="ai-guardrails-heading" className="text-sm font-semibold text-[var(--text-strong)]">
          AI guardrails
        </h2>
      </div>
      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${badgeClassName}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xs text-[var(--text-faint)]">{description}</p>
    </div>
  );
}

function OperationGroup({
  title,
  operations,
}: {
  title: string;
  operations: DocumentAiOperation[];
}) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        {title}
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {operations.map((operation) => (
          <span
            key={operation}
            className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--text-main)]"
          >
            {OPERATION_LABELS[operation]}
          </span>
        ))}
      </div>
    </div>
  );
}

function DeniedOperationGroup({ operations }: { operations: DocumentAiDeniedOperation[] }) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        Blocked content operations
      </span>
      {operations.length > 0 ? (
        <div className="mt-2 space-y-2">
          {operations.map((entry) => (
            <div
              key={entry.operation}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2.5 py-2 text-xs"
            >
              <p className="font-medium text-[var(--text-main)]">
                {OPERATION_LABELS[entry.operation]}
              </p>
              <p className="mt-1 text-[var(--text-faint)]">{entry.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-main)]">No content operations blocked</p>
      )}
    </div>
  );
}
