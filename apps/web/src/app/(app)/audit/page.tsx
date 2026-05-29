'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuditQuery } from '@/lib/hooks/use-audit';
import { verifyAuditChain } from '@/features/audit/audit.api';
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
import { RefreshCw, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<AuditQueryFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [chainStatus, setChainStatus] = useState<AuditChainStatus | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [verifyChainError, setVerifyChainError] = useState<string | null>(null);

  const hasAccess = canViewAudit(session);

  const { data: logs, isLoading, isError, refetch } = useAuditQuery(filters, page, pageSize);

  const total = logs?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleVerifyChain() {
    setIsVerifyingChain(true);
    setVerifyChainError(null);
    try {
      setChainStatus(await verifyAuditChain());
    } catch {
      setVerifyChainError('Audit chain verification failed.');
    } finally {
      setIsVerifyingChain(false);
    }
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
          {chainStatus?.valid === false ? (
            <ShieldAlert className="h-5 w-5 text-red-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              {chainStatus
                ? chainStatus.valid
                  ? 'Audit chain valid'
                  : 'Audit chain invalid'
                : 'Audit chain'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {verifyChainError ??
                (chainStatus
                  ? `${chainStatus.checked} events checked${chainStatus.message ? ` - ${chainStatus.message}` : ''}`
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

      <div className="animate-in delay-2">
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
