'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuditQuery } from '@/lib/hooks/use-audit';
import { PageHeader } from '@/components/common/page-header';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { AuditQueryFilters } from '@/types/audit';
import { Search } from 'lucide-react';

export default function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<AuditQueryFilters>({ limit: 100 });

  const hasAccess = session?.roles.some((r) => ['compliance_officer', 'admin'].includes(r));

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
      {!isLoading && !isError && <AuditTable data={logs ?? []} />}
    </div>
  );
}
