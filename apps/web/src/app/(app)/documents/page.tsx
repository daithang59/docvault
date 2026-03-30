'use client';

import { useState, useMemo } from 'react';
import { useDocuments, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument, useDeleteDocument } from '@/lib/hooks/use-documents';
import { deleteDocument } from '@/lib/api/workflow';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { submitDocument, approveDocument, archiveDocument } from '@/lib/api/workflow';
import { useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { PageHeader } from '@/components/common/page-header';
import { DocumentsTable } from '@/components/documents/documents-table';
import { DocumentFilters, DocumentFiltersState } from '@/components/documents/document-filters';
import { EmptyState } from '@/components/common/empty-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ProtectedAction } from '@/components/common/protected-action';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TablePagination } from '@/components/data-table/table-pagination';
import { DocumentListItem } from '@/types/document';
import { ROUTES } from '@/lib/constants/routes';
import { FilePlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';
import { parseApiError } from '@/lib/api/errors';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';

const DEFAULT_FILTERS: DocumentFiltersState = {
  search: '',
  status: '',
  classification: '',
  sort: 'updatedAt',
  sortDir: 'desc',
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const { data: docs, isLoading, isError, refetch } = useDocuments();

  const [filters, setFilters] = useState<DocumentFiltersState>(DEFAULT_FILTERS);
  const [targetDoc, setTargetDoc] = useState<DocumentListItem | null>(null);
  const [actionType, setActionType] = useState<'submit' | 'approve' | 'reject' | 'archive' | 'delete' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const submit = useSubmitDocument(targetDoc?.id ?? '');
  const approve = useApproveDocument(targetDoc?.id ?? '');
  const reject = useRejectDocument(targetDoc?.id ?? '');
  const archive = useArchiveDocument(targetDoc?.id ?? '');
  const deleteDoc = useDeleteDocument(targetDoc?.id ?? '');
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

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
      if (type === 'delete') {
        await deleteDoc.mutateAsync();
        toast.success('Document deleted.');
      }
    } catch (e) {
      const err = parseApiError(e);
      let msg: string;
      if (err.statusCode === 409) {
        if (type === 'submit') msg = TOAST_MESSAGES.CONFLICT_SUBMIT;
        else if (type === 'approve') msg = TOAST_MESSAGES.CONFLICT_APPROVE;
        else if (type === 'reject') msg = TOAST_MESSAGES.CONFLICT_REJECT;
        else if (type === 'archive') msg = TOAST_MESSAGES.CONFLICT_ARCHIVE;
        else if (type === 'delete') msg = TOAST_MESSAGES.CONFLICT_DELETE;
        else msg = err.message;
      } else if (err.statusCode === 403) {
        msg = TOAST_MESSAGES.FORBIDDEN_ACTION;
      } else if (type === 'archive' && err.statusCode === 404) {
        msg = TOAST_MESSAGES.ARCHIVE_UNAVAILABLE;
      } else {
        msg = e instanceof ApiError ? e.message : 'Operation failed.';
      }
      toast.error(msg);
    } finally {
      setTargetDoc(null); setActionType(null); setRejectReason('');
      setPage(1);
    }
  }

  async function handleBulkAction(
    docs: DocumentListItem[],
    action: (id: string) => Promise<unknown>,
    label: string,
  ) {
    let ok = 0;
    let fail = 0;
    for (const doc of docs) {
      try {
        await action(doc.id);
        ok++;
      } catch {
        fail++;
      }
    }
    if (ok > 0) toast.success(`${label}: ${ok} succeeded${fail > 0 ? `, ${fail} failed` : ''}`);
    else toast.error(`${label}: all ${fail} failed`);
    qc.invalidateQueries({ queryKey: documentsKeys.lists() });
    setPage(1);
  }

  async function handleBulkDelete(docs: DocumentListItem[]) {
    let ok = 0;
    let fail = 0;
    for (const doc of docs) {
      try {
        await deleteDocument(doc.id);
        ok++;
      } catch {
        fail++;
      }
    }
    if (ok > 0) toast.success(`Deleted: ${ok} succeeded${fail > 0 ? `, ${fail} failed` : ''}`);
    else toast.error(`Delete failed for all ${fail} documents`);
    qc.invalidateQueries({ queryKey: documentsKeys.lists() });
    setPage(1);
  }

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="Documents"
          subtitle="Manage and review secure documents across their lifecycle."
          actions={
            <ProtectedAction roles={['editor', 'admin']}>
              <Link href={ROUTES.DOCUMENTS_NEW} className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition">
                <FilePlus className="h-4 w-4" />
                New Document
              </Link>
            </ProtectedAction>
          }
        />
      </div>

      <div className="animate-in delay-2">
        <DocumentFilters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
      </div>

      {filtered.length === 0 ? (
        <div className="animate-in delay-3">
          <EmptyState
            title="No documents found"
          description={filters.search || filters.status || filters.classification
            ? 'Try adjusting your filters.'
            : 'Create your first document to get started.'
          }
          icon="document"
          action={
            <ProtectedAction roles={['editor', 'admin']}>
              <Link href={ROUTES.DOCUMENTS_NEW} className="btn-primary rounded-xl px-4 py-2 text-sm font-medium text-white transition">
                Create Document
              </Link>
            </ProtectedAction>
          }
          />
        </div>
      ) : (
        <>
          <div className="animate-in delay-3">
            <DocumentsTable
              data={paginated}
              enableSelection
              onSubmit={(doc) => { setTargetDoc(doc); setActionType('submit'); }}
              onApprove={(doc) => { setTargetDoc(doc); setActionType('approve'); }}
              onReject={(doc) => { setTargetDoc(doc); setActionType('reject'); }}
              onArchive={(doc) => { setTargetDoc(doc); setActionType('archive'); }}
              onDelete={(doc) => { setTargetDoc(doc); setActionType('delete'); }}
              onDownload={(doc) => download(doc.id)}
              onBulkSubmit={(docs) => handleBulkAction(docs, submitDocument, 'Bulk Submit')}
              onBulkApprove={(docs) => handleBulkAction(docs, approveDocument, 'Bulk Approve')}
              onBulkArchive={(docs) => handleBulkAction(docs, archiveDocument, 'Bulk Archive')}
              onBulkDelete={handleBulkDelete}
            />
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        </>
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
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:border-[var(--border-focus)]"
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
      <ConfirmDialog
        open={actionType === 'delete'}
        onOpenChange={(o) => !o && setActionType(null)}
        title="Delete Document"
        description="This document will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => handleAction('delete')}
      />
    </div>
  );
}
