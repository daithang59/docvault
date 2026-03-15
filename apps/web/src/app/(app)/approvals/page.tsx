'use client';

import { useState, useMemo } from 'react';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/common/page-header';
import { ApprovalsTable } from '@/components/approvals/approvals-table';
import { ApprovalReviewDrawer } from '@/components/approvals/approval-review-drawer';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { DocumentListItem } from '@/types/document';

export default function ApprovalsPage() {
  const { session } = useAuth();
  const { data: docs, isLoading, isError, refetch } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState<DocumentListItem | null>(null);

  // Check access
  const hasAccess = session?.roles.some((r) => ['approver', 'admin'].includes(r));

  const pendingDocs = useMemo(
    () => (docs ?? []).filter((d) => d.status === 'PENDING'),
    [docs]
  );

  if (!hasAccess) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#64748B]">You do not have permission to access approvals.</p>
      </div>
    );
  }

  if (isLoading) return <LoadingState label="Loading approvals..." />;
  if (isError) return <ErrorState message="Failed to load documents." onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Review pending submissions and publish approved documents."
        badge={
          pendingDocs.length > 0 ? (
            <span className="text-xs font-bold text-white bg-[#92400E] px-2 py-0.5 rounded-full">
              {pendingDocs.length}
            </span>
          ) : null
        }
      />

      {pendingDocs.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="All documents have been reviewed. Check back later."
          icon="list"
        />
      ) : (
        <ApprovalsTable
          data={pendingDocs}
          onReview={(doc) => setSelectedDoc(doc)}
        />
      )}

      <ApprovalReviewDrawer
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}
