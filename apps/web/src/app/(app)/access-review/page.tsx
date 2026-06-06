'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { StatusBadge } from '@/components/badges/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { buildAccessReviewModel } from '@/features/access-review/access-review';
import { getAccessReviewDocuments } from '@/features/access-review/access-review.api';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';

const postureStyles = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function AccessReviewPage() {
  const { session } = useAuth();
  const hasAccess = canViewAudit(session);
  const documentsQuery = useQuery({
    queryKey: ['access-review', 'documents'] as const,
    queryFn: getAccessReviewDocuments,
    enabled: hasAccess,
  });
  const model = useMemo(
    () => buildAccessReviewModel(documentsQuery.data ?? []),
    [documentsQuery.data],
  );
  const isLoading = documentsQuery.isLoading;
  const isError = documentsQuery.isError;
  const isFetching = documentsQuery.isFetching;

  async function refreshAccessReview() {
    await documentsQuery.refetch();
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Compliance Officer or Admin role to review sensitive document access."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Your current role does not have sufficient permissions.</span>
          </div>
        }
      />
    );
  }

  if (isLoading) return <LoadingState label="Loading access review..." />;
  if (isError) {
    return (
      <ErrorState
        message="Failed to load access review evidence."
        onRetry={refreshAccessReview}
      />
    );
  }

  const summaryCards = [
    { label: 'Reviewed documents', value: model.summary.reviewedDocuments },
    { label: 'Open reviews', value: model.summary.openReviews },
    { label: 'Critical reviews', value: model.summary.criticalReviews },
    { label: 'Stale permissions', value: model.summary.stalePermissions },
  ];

  return (
    <div>
      <PageHeader
        title="Access Review"
        subtitle="Permission recertification for sensitive documents and broad ACL grants."
        actions={
          <>
            <button
              type="button"
              onClick={refreshAccessReview}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href={ROUTES.SECURITY}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
              style={{ background: 'var(--color-primary)' }}
            >
              Security
              <ExternalLink className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section
        className="mb-5 rounded-lg border p-4"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${postureStyles[model.posture.level]}`}
            >
              {model.posture.level === 'healthy' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--text-strong)]">
                {model.posture.label}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                {model.posture.description}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
            <KeyRound className="h-4 w-4" />
            {model.summary.broadAccessGrants} broad grant
            {model.summary.broadAccessGrants === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border p-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {model.reviews.length === 0 ? (
        <EmptyState
          icon="audit"
          title="No access reviews"
          description="Sensitive documents do not currently have broad or stale ACL grants."
        />
      ) : (
        <section
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
                  <Th>Severity</Th>
                  <Th>Subject</Th>
                  <Th>Permission</Th>
                  <Th>Evidence</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {model.reviews.map((review) => (
                  <tr
                    key={review.id}
                    className="border-b last:border-0"
                    style={{ borderColor: 'var(--table-row-border)' }}
                  >
                    <td className="min-w-72 px-4 py-3">
                      <Link
                        href={review.href}
                        className="text-sm font-medium text-[var(--text-main)] transition-colors hover:text-[var(--color-primary)]"
                      >
                        {review.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ClassificationBadge classification={review.classification} />
                        <StatusBadge status={review.status} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                        {review.reason}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
                          review.severity === 'critical'
                            ? postureStyles.critical
                            : postureStyles.warning
                        }`}
                      >
                        {review.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-main)]">
                      {review.subject}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {review.permission}
                    </td>
                    <td className="min-w-72 px-4 py-3">
                      <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                        {review.evidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-faint)]">
                        {review.recommendedAction}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={review.href}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-muted)]"
                        >
                          {review.nextActionLabel}
                        </Link>
                        <Link
                          href={review.auditHref}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          Audit evidence
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="border-t px-4 py-3 text-xs text-[var(--text-muted)]"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            Last recalculated {formatDateTime(new Date().toISOString())}
          </div>
        </section>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-text)]">
      {children}
    </th>
  );
}
