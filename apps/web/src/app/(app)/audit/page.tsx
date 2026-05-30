'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuditQuery } from '@/lib/hooks/use-audit';
import {
  getSecuritySummary,
  verifyAuditChain,
} from '@/features/audit/audit.api';
import { auditKeys } from '@/features/audit/audit.keys';
import { buildSecurityDashboardModel } from '@/features/audit/security-dashboard';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { TablePagination } from '@/components/data-table/table-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import type {
  AuditChainStatus,
  AuditQueryFilters,
} from '@/features/audit/audit.types';
import { canViewAudit } from '@/lib/auth/guards';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';
import {
  Bug,
  Download,
  FileWarning,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

export default function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<AuditQueryFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [chainStatus, setChainStatus] = useState<AuditChainStatus | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [verifyChainError, setVerifyChainError] = useState<string | null>(null);

  const hasAccess = canViewAudit(session);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextFilters: AuditQueryFilters = {};

    const result = params.get('result');
    const action = params.get('action');
    const actorId = params.get('actorId');
    const resourceType = params.get('resourceType');
    const resourceId = params.get('resourceId');
    const documentId = params.get('documentId');

    if (result === 'SUCCESS' || result === 'DENY' || result === 'ERROR' || result === 'CONFLICT') {
      nextFilters.result = result;
    }
    if (action) nextFilters.action = action;
    if (actorId) nextFilters.actorId = actorId;
    if (resourceType) nextFilters.resourceType = resourceType;
    if (resourceId) nextFilters.resourceId = resourceId;
    if (documentId) nextFilters.documentId = documentId;

    if (Object.keys(nextFilters).length > 0) {
      setFilters(nextFilters);
      setPage(1);
    }
  }, []);

  const { data: logs, isLoading, isError, refetch } = useAuditQuery(
    filters,
    page,
    pageSize,
    hasAccess,
  );
  const {
    data: securitySummary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: auditKeys.securitySummary(),
    queryFn: getSecuritySummary,
    enabled: hasAccess,
  });

  const total = logs?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const displayedChainStatus = chainStatus ?? securitySummary?.chain ?? null;
  const securityDashboardModel = useMemo(
    () => buildSecurityDashboardModel(securitySummary),
    [securitySummary],
  );
  const summaryCards = [
    {
      label: 'Denied events',
      value: securitySummary?.totals.deniedEvents,
      icon: ShieldX,
    },
    {
      label: 'Malware blocked',
      value: securitySummary?.totals.malwareBlocked,
      icon: Bug,
    },
    {
      label: 'DLP hits',
      value: securitySummary?.totals.dlpDetections,
      icon: FileWarning,
    },
    {
      label: 'Download denied',
      value: securitySummary?.totals.downloadDenied,
      icon: Download,
    },
  ];

  async function handleVerifyChain() {
    setIsVerifyingChain(true);
    setVerifyChainError(null);
    try {
      setChainStatus(await verifyAuditChain());
      await refetchSummary();
    } catch {
      setVerifyChainError('Audit chain verification failed.');
    } finally {
      setIsVerifyingChain(false);
    }
  }

  function applyQuickFilter(nextFilters: AuditQueryFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Compliance Officer or Admin role to view audit logs."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Your current role does not have sufficient permissions.</span>
          </div>
        }
      />
    );
  }

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="Audit"
          subtitle="Inspect immutable audit records and access events."
        />
      </div>

      <div
        className="mb-5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="flex items-center gap-3">
          {displayedChainStatus?.valid === false ? (
            <ShieldAlert className="h-5 w-5 text-red-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              {displayedChainStatus
                ? displayedChainStatus.valid
                  ? 'Audit chain valid'
                  : 'Audit chain invalid'
                : 'Audit chain'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {verifyChainError ??
                (displayedChainStatus
                  ? `${displayedChainStatus.checked} events checked${displayedChainStatus.message ? ` - ${displayedChainStatus.message}` : ''}`
                  : 'Not checked')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleVerifyChain}
          disabled={isVerifyingChain}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isVerifyingChain ? 'animate-spin' : ''}`}
          />
          Verify Chain
        </button>
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
                {isSummaryLoading ? '...' : (card.value ?? 0)}
              </p>
            </div>
          );
        })}
      </div>

      {securitySummary?.repeatedDenyActors.length ? (
        <div
          className="mb-5 rounded-lg border p-4"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Repeated deny actors
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {securitySummary.repeatedDenyActors.map((actor) => (
              <span
                key={actor.actorId}
                className="rounded-md border border-[var(--border-soft)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
              >
                {actor.actorId}: {actor.denyCount}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="animate-in delay-2">
        <div
          className="mb-5 rounded-lg border p-4"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">
                Quick investigations
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Jump directly to high-signal security event classes.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {securityDashboardModel.quickFilters.map((item) => {
              const active =
                filters.result === item.filters.result &&
                filters.action === item.filters.action;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => applyQuickFilter(item.filters)}
                  className="rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--bg-subtle)]"
                  style={{
                    borderColor: active ? 'var(--color-primary)' : 'var(--border-soft)',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                  }}
                >
                  <span className="block text-xs font-semibold text-[var(--text-main)]">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-faint)]">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <AuditFilters
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1); }}
        />
      </div>

      {isLoading && <LoadingState label="Querying audit logs..." />}
      {isError && <ErrorState message="Failed to load audit logs." onRetry={refetch} />}
      {!isLoading && !isError && (
        <div className="animate-in delay-3">
          <AuditTable
            data={logs?.data ?? []}
            total={total}
            page={page}
            pageSize={pageSize}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
}
