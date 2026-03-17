'use client';

import { useState, useMemo } from 'react';
import { useDocuments, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument } from '@/lib/hooks/use-documents';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { PageHeader } from '@/components/common/page-header';
import { DocumentsTable } from '@/components/documents/documents-table';
import { DocumentFilters, DocumentFiltersState } from '@/components/documents/document-filters';
import { EmptyState } from '@/components/common/empty-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ProtectedAction } from '@/components/common/protected-action';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DocumentListItem } from '@/types/document';
import { ROUTES } from '@/lib/constants/routes';
import { FilePlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';

const DEFAULT_FILTERS: DocumentFiltersState = {
  search: '',
  status: '',
  classification: '',
  sort: 'updatedAt',
  sortDir: 'desc',
};

export default function DocumentsPage() {
  const { data: docs, isLoading, isError, refetch } = useDocuments();

  const [filters, setFilters] = useState<DocumentFiltersState>(DEFAULT_FILTERS);
  const [targetDoc, setTargetDoc] = useState<DocumentListItem | null>(null);
  const [actionType, setActionType] = useState<'submit' | 'approve' | 'reject' | 'archive' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const submit = useSubmitDocument(targetDoc?.id ?? '');
  const approve = useApproveDocument(targetDoc?.id ?? '');
  const reject = useRejectDocument(targetDoc?.id ?? '');
  const archive = useArchiveDocument(targetDoc?.id ?? '');
  const { download } = useDownloadDocument({
    onError: (msg) => toast.error(msg),
  });

  const filtered = useMemo(() => {
    if (!docs) return [];
    let result = [...docs.data];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filters.status) result = result.filter((d) => d.status === filters.status);
    if (filters.classification) result = result.filter(
      (d) => (d.classificationLevel ?? d.classification) === filters.classification
    );
    result.sort((a, b) => {
      const valA: string | number = a[filters.sort as keyof DocumentListItem] as string ?? '';
      const valB: string | number = b[filters.sort as keyof DocumentListItem] as string ?? '';
      const cmp = String(valA).localeCompare(String(valB));
      return filters.sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [docs, filters]);

  if (isLoading) return (
    <div>
      <PageHeader title="Documents" subtitle="Manage and review secure documents across their lifecycle." />
      <TableSkeleton rows={6} />
    </div>
  );

  if (isError) return <ErrorState message="Failed to load documents." onRetry={refetch} />;

  async function handleAction(type: typeof actionType) {
    if (!targetDoc) return;
    try {
      if (type === 'submit') { await submit.mutateAsync(); toast.success(TOAST_MESSAGES.SUBMITTED); }
      if (type === 'approve') { await approve.mutateAsync(); toast.success(TOAST_MESSAGES.APPROVED); }
      if (type === 'reject') { await reject.mutateAsync(rejectReason || undefined); toast.success(TOAST_MESSAGES.REJECTED); }
      if (type === 'archive') {
        await archive.mutateAsync();
        toast.success(TOAST_MESSAGES.ARCHIVED);
      }
    } catch (e) {
      const msg = e instanceof ApiError
        ? (type === 'archive' && e.statusCode === 404 ? TOAST_MESSAGES.ARCHIVE_UNAVAILABLE : e.message)
        : 'Operation failed.';
      toast.error(msg);
    } finally {
      setTargetDoc(null); setActionType(null); setRejectReason('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Manage and review secure documents across their lifecycle."
        actions={
          <ProtectedAction roles={['editor', 'admin']}>
            <Link href={ROUTES.DOCUMENTS_NEW} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium transition">
              <FilePlus className="h-4 w-4" />
              New Document
            </Link>
          </ProtectedAction>
        }
      />

      <DocumentFilters filters={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState
          title="No documents found"
          description={filters.search || filters.status || filters.classification
            ? "Try adjusting your filters."
            : "Create your first document to get started."
          }
          icon="document"
          action={
            <ProtectedAction roles={['editor', 'admin']}>
              <Link href={ROUTES.DOCUMENTS_NEW} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition">
                Create Document
              </Link>
            </ProtectedAction>
          }
        />
      ) : (
        <DocumentsTable
          data={filtered}
          onSubmit={(doc) => { setTargetDoc(doc); setActionType('submit'); }}
          onApprove={(doc) => { setTargetDoc(doc); setActionType('approve'); }}
          onReject={(doc) => { setTargetDoc(doc); setActionType('reject'); }}
          onArchive={(doc) => { setTargetDoc(doc); setActionType('archive'); }}
          onDownload={(doc) => download(doc.id)}
        />
      )}

      <ConfirmDialog
        open={actionType === 'submit'}
        onOpenChange={(o) => !o && setActionType(null)}
        title="Submit Document"
        description="Send this document for approval?"
        confirmLabel="Submit"
        onConfirm={() => handleAction('submit')}
      />
      <ConfirmDialog
        open={actionType === 'approve'}
        onOpenChange={(o) => !o && setActionType(null)}
        title="Approve Document"
        description="This document will be published."
        confirmLabel="Approve"
        onConfirm={() => handleAction('approve')}
      />
      <ConfirmDialog
        open={actionType === 'reject'}
        onOpenChange={(o) => !o && setActionType(null)}
        title="Reject Document"
        description="Document will return to Draft."
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={() => handleAction('reject')}
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (optional)..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl resize-none outline-none focus:border-[#2563EB] transition"
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={actionType === 'archive'}
        onOpenChange={(o) => !o && setActionType(null)}
        title="Archive Document"
        description="Document will be archived."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => handleAction('archive')}
      />
    </div>
  );
}
