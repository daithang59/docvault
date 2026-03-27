'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuditQuery } from '@/lib/hooks/use-audit';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { TablePagination } from '@/components/data-table/table-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import type { AuditQueryFilters } from '@/features/audit/audit.types';
import { canViewAudit } from '@/lib/auth/guards';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';
import { Shield } from 'lucide-react';

export default function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<AuditQueryFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const hasAccess = canViewAudit(session);

  const { data: logs, isLoading, isError, refetch } = useAuditQuery(filters, page, pageSize);

  const total = logs?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Không có quyền truy cập"
        description="Bạn cần vai trò Compliance Officer hoặc Admin để xem nhật ký audit."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Vai trò hiện tại của bạn không đủ quyền.</span>
          </div>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit"
        subtitle="Inspect immutable audit records and access events."
      />

      <AuditFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(1); }}
      />

      {isLoading && <LoadingState label="Querying audit logs..." />}
      {isError && <ErrorState message="Failed to load audit logs." onRetry={refetch} />}
      {!isLoading && !isError && (
        <>
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
        </>
      )}
    </div>
  );
}
