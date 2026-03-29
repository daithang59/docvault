'use client';

import { useState, useMemo } from 'react';
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
import { Shield } from 'lucide-react';

export default function ApprovalsPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: docs, isLoading, isError, refetch } = useApprovalQueue();
  const [selectedDoc, setSelectedDoc] = useState<DocumentListItem | null>(null);

  const hasAccess = canViewApprovals(session);

  const pendingDocs = useMemo(
    () => docs?.data ?? [],
    [docs]
  );

  const total = docs?.total ?? pendingDocs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return pendingDocs.slice(start, start + pageSize);
  }, [pendingDocs, page, pageSize]);

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
        <div className="animate-in delay-2">
          <ApprovalsTable
            data={paginated}
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
        </div>
      )}

      <ApprovalReviewDrawer
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}
