'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, CalendarClock, RefreshCw, Shield, TimerReset } from 'lucide-react';
import { toast } from 'sonner';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { StatusBadge } from '@/components/badges/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { StepUpConfirmDialog } from '@/components/common/step-up-confirm-dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { getSensitiveActionStepUp } from '@/features/security/sensitive-action';
import {
  useRetentionEvidence,
  useRunRetention,
} from '@/features/retention/retention.hooks';
import type {
  RetentionEvidenceRecord,
  RetentionStatus,
} from '@/features/retention/retention.types';

const STATUS_STYLES: Record<RetentionStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DUE_SOON: 'border-amber-200 bg-amber-50 text-amber-700',
  OVERDUE: 'border-red-200 bg-red-50 text-red-700',
  ARCHIVED: 'border-slate-200 bg-slate-50 text-slate-700',
  UNSET: 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
};

export default function RetentionPage() {
  const { session } = useAuth();
  const hasAccess = canViewAudit(session);
  const isAdmin = session?.user.roles.includes('admin') ?? false;
  const [isRunRetentionStepUpOpen, setIsRunRetentionStepUpOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useRetentionEvidence();
  const runRetention = useRunRetention();

  async function handleRunRetention(challengePhrase: string) {
    try {
      const result = await runRetention.mutateAsync({ challengePhrase });
      toast.success(`Retention run archived ${result.archived} record${result.archived === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Retention run failed.');
    }
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Compliance Officer or Admin role to view retention evidence."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Your current role does not have sufficient permissions.</span>
          </div>
        }
      />
    );
  }

  if (isLoading) return <LoadingState label="Loading retention records..." />;
  if (isError || !data) {
    return <ErrorState message="Failed to load retention evidence." onRetry={refetch} />;
  }

  const summaryCards = [
    { label: 'Tracked Records', value: data.summary.tracked, icon: Archive },
    { label: 'Due Soon', value: data.summary.dueSoon, icon: CalendarClock },
    { label: 'Overdue', value: data.summary.overdue, icon: TimerReset },
    { label: 'Archived', value: data.summary.archived, icon: Archive },
  ];

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="Retention"
          subtitle="Records lifecycle evidence and auto-archive status."
          actions={
            isAdmin ? (
              <button
                type="button"
                onClick={() => setIsRunRetentionStepUpOpen(true)}
                disabled={runRetention.isPending}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${runRetention.isPending ? 'animate-spin' : ''}`}
                />
                Run Retention
              </button>
            ) : null
          }
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border p-4"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-muted)]">
                  {card.label}
                </p>
                <Icon className="h-4 w-4 text-[var(--text-faint)]" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {data.records.length === 0 ? (
        <EmptyState
          title="No retention records"
          description="Published documents will appear here after approval."
          icon="document"
        />
      ) : (
        <div
          className="overflow-hidden rounded-lg border"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead
                style={{
                  background: 'var(--table-header-bg)',
                  borderBottom: '1px solid var(--table-header-border)',
                }}
              >
                <tr>
                  <Th>Document</Th>
                  <Th>Status</Th>
                  <Th>Classification</Th>
                  <Th>Retention</Th>
                  <Th>Published</Th>
                  <Th>Retain Until</Th>
                  <Th>Days</Th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <RetentionRow key={record.docId} record={record} />
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="border-t px-4 py-3 text-xs text-[var(--text-muted)]"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            Last checked {formatDateTime(data.checkedAt)}
          </div>
        </div>
      )}

      <StepUpConfirmDialog
        open={isRunRetentionStepUpOpen}
        onOpenChange={setIsRunRetentionStepUpOpen}
        stepUp={getSensitiveActionStepUp('run-retention')}
        loading={runRetention.isPending}
        onConfirm={handleRunRetention}
      />
    </div>
  );
}

function RetentionRow({ record }: { record: RetentionEvidenceRecord }) {
  return (
    <tr
      className="border-b last:border-0"
      style={{ borderColor: 'var(--table-row-border)' }}
    >
      <td className="min-w-60 px-4 py-3">
        <Link
          href={ROUTES.DOCUMENT_DETAIL(record.docId)}
          className="text-sm font-medium text-[var(--text-main)] transition-colors hover:text-[var(--color-primary)]"
        >
          {record.title}
        </Link>
        {record.retentionReason ? (
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {record.retentionReason}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={record.status} />
      </td>
      <td className="px-4 py-3">
        <ClassificationBadge classification={record.classification} />
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[record.retentionStatus]}`}
        >
          {record.retentionStatus.replace('_', ' ')}
        </span>
        {record.retentionClass ? (
          <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
            {record.retentionClass}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
        {formatDateTime(record.publishedAt)}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
        {formatDateTime(record.retentionUntil)}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
        {record.daysRemaining ?? '-'}
      </td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-text)]">
      {children}
    </th>
  );
}
