'use client';

import { useMemo, useState } from 'react';
import { useApprovalQueue } from '@/features/approvals/approvals.hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/common/page-header';
import { ApprovalsTable } from '@/components/common/approvals/approvals-table';
import { ApprovalReviewDrawer } from '@/components/common/approvals/approval-review-drawer';
import { TablePagination } from '@/components/data-table/table-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { DocumentListItem } from '@/types/document';
import { canViewApprovals } from '@/lib/auth/guards';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import {
  buildApprovalQueueSlaModel,
  type ApprovalQueueSlaSummary,
  type ApprovalSlaFilter,
  type ApprovalSlaSort,
} from '@/features/approvals/approval-sla';

const SLA_FILTERS: Array<{ value: ApprovalSlaFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'on-track', label: 'On time' },
];

const SLA_SORTS: Array<{ value: ApprovalSlaSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'due-date', label: 'Due date' },
  { value: 'queued-time', label: 'Queued time' },
];

export default function ApprovalsPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [slaFilter, setSlaFilter] = useState<ApprovalSlaFilter>('all');
  const [slaSort, setSlaSort] = useState<ApprovalSlaSort>('priority');
  const now = useMemo(() => new Date().toISOString(), []);

  const { data: docs, isLoading, isError, refetch } = useApprovalQueue();
  const [selectedDoc, setSelectedDoc] = useState<DocumentListItem | null>(null);

  const hasAccess = canViewApprovals(session);

  const pendingDocs = useMemo(
    () => docs?.data ?? [],
    [docs]
  );

  const slaModel = useMemo(
    () =>
      buildApprovalQueueSlaModel(pendingDocs, {
        now,
        filter: slaFilter,
        sort: slaSort,
      }),
    [pendingDocs, now, slaFilter, slaSort],
  );

  const total = slaModel.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return slaModel.rows.slice(start, start + pageSize);
  }, [slaModel.rows, page, pageSize]);

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Approver or Admin role to view this page."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Your current role does not have sufficient permissions.</span>
          </div>
        }
      />
    );
  }

  if (isLoading) return <LoadingState label="Loading approvals..." />;
  if (isError) return <ErrorState message="Failed to load documents." onRetry={refetch} />;

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="Approvals"
          subtitle="Review pending submissions and publish approved documents."
          badge={
            pendingDocs.length > 0 ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'var(--status-pending-text)' }}>
                {pendingDocs.length}
              </span>
            ) : null
          }
        />
      </div>

      {pendingDocs.length === 0 ? (
        <div className="animate-in delay-2">
          <EmptyState
            title="No pending approvals"
            description="All documents have been reviewed. Check back later."
            icon="list"
          />
        </div>
      ) : (
        <div className="animate-in delay-2 space-y-4">
          <ApprovalSlaSummaryCards summary={slaModel.summary} />
          <ApprovalSlaControls
            filter={slaFilter}
            sort={slaSort}
            onFilterChange={(value) => {
              setSlaFilter(value);
              setPage(1);
            }}
            onSortChange={(value) => {
              setSlaSort(value);
              setPage(1);
            }}
          />
          {slaModel.rows.length === 0 ? (
            <EmptyState
              title="No approvals match this SLA view"
              description="Switch the SLA filter to see the rest of the queue."
              icon="list"
            />
          ) : (
            <>
              <ApprovalsTable
                rows={paginatedRows}
                onReview={(doc) => setSelectedDoc(doc)}
              />
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </>
          )}
        </div>
      )}

      <ApprovalReviewDrawer
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}

function ApprovalSlaSummaryCards({
  summary,
}: {
  summary: ApprovalQueueSlaSummary;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <ApprovalSlaSummaryCard
        icon={AlertTriangle}
        label="Overdue"
        value={summary.overdue}
        tone="danger"
      />
      <ApprovalSlaSummaryCard
        icon={Clock}
        label="Due soon"
        value={summary.dueSoon}
        tone="warning"
      />
      <ApprovalSlaSummaryCard
        icon={CheckCircle}
        label="On time"
        value={summary.onTrack}
        tone="success"
      />
      <ApprovalSlaSummaryCard
        icon={Shield}
        label="Compliance"
        value={summary.complianceReview}
        tone="neutral"
      />
    </div>
  );
}

function ApprovalSlaSummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : tone === 'success'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-sky-50 text-sky-700 ring-sky-200';

  return (
    <div className="rounded-2xl border bg-[var(--bg-card)] p-4" style={{ borderColor: 'var(--border-soft)' }}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {label}
          </p>
          <p className="text-xl font-semibold text-[var(--text-strong)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ApprovalSlaControls({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: {
  filter: ApprovalSlaFilter;
  sort: ApprovalSlaSort;
  onFilterChange: (value: ApprovalSlaFilter) => void;
  onSortChange: (value: ApprovalSlaSort) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-[var(--bg-card)] p-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--border-soft)' }}>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
        <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
        SLA queue
      </div>
      <div className="flex flex-wrap gap-2">
        {SLA_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === item.value
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--border-soft)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            {item.label}
          </button>
        ))}
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ApprovalSlaSort)}
          className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] outline-none"
        >
          {SLA_SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              Sort: {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
