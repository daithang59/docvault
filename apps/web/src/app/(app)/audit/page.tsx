'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuditQuery } from '@/lib/hooks/use-audit';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import type { AuditQueryFilters } from '@/features/audit/audit.types';
import { canViewAudit } from '@/lib/auth/guards';

export default function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<AuditQueryFilters>({});

  const hasAccess = canViewAudit(session);

  const { data: logs, isLoading, isError, refetch } = useAuditQuery(filters);

  if (!hasAccess) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#64748B]">You do not have permission to access audit logs.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit"
        subtitle="Inspect immutable audit records and access events."
      />

      <AuditFilters filters={filters} onChange={setFilters} />

      {isLoading && <LoadingState label="Querying audit logs..." />}
      {isError && <ErrorState message="Failed to load audit logs." onRetry={refetch} />}
      {!isLoading && !isError && <AuditTable data={logs?.data ?? []} />}
    </div>
  );
}
