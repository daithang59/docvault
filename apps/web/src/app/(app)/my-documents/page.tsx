'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDocuments, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument, useDeleteDocument } from '@/lib/hooks/use-documents';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { submitDocument, approveDocument, archiveDocument, deleteDocument } from '@/lib/api/workflow';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/common/page-header';
import { DocumentsTable } from '@/components/documents/documents-table';
import { DocumentFilters } from '@/components/documents/document-filters';
import {
  DEFAULT_DOCUMENT_FILTERS,
  buildDocumentFilterOptions,
  buildDocumentQuickViewOptions,
  buildDocumentSearchSuggestions,
  countActiveDocumentFilters,
  describeActiveDocumentFilters,
  filterAndSortDocuments,
  parseDocumentFiltersFromSearchParams,
  serializeDocumentFiltersToSearchParams,
  type DocumentFiltersState,
} from '@/features/documents/document-filter-model';
import {
  DOCUMENT_SAVED_VIEWS_STORAGE_KEY,
  buildDocumentSavedViewOptions,
  createCustomDocumentSavedView,
  findMatchingDocumentSavedViewId,
  parseCustomDocumentSavedViews,
  serializeCustomDocumentSavedViews,
  type DocumentSavedView,
} from '@/features/documents/document-saved-views';
import {
  createPersistedDocumentSavedView,
  deletePersistedDocumentSavedView,
  listPersistedDocumentSavedViews,
} from '@/features/documents/document-saved-views.api';
import { EmptyState } from '@/components/common/empty-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TablePagination } from '@/components/data-table/table-pagination';
import { DocumentListItem } from '@/types/document';
import { ROUTES } from '@/lib/constants/routes';
import { FilePlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';
import { getErrorMessage, parseApiError } from '@/lib/api/errors';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';

export default function MyDocumentsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const { data: docs, isLoading, isError, refetch } = useDocuments();

  const [filters, setFilters] = useState<DocumentFiltersState>(DEFAULT_DOCUMENT_FILTERS);
  const [localSavedViews, setLocalSavedViews] = useState<DocumentSavedView[]>(
    () => loadCustomDocumentSavedViews(),
  );
  const [filtersHydrated, setFiltersHydrated] = useState(false);
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
  const persistedSavedViewsQuery = useQuery({
    queryKey: documentsKeys.savedViews(),
    queryFn: listPersistedDocumentSavedViews,
    retry: false,
  });

  // Backend stores ownerId as sub (Keycloak UUID)
  const currentUserId = session?.user?.sub ?? '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(parseDocumentFiltersFromSearchParams(params));
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;

    const params = serializeDocumentFiltersToSearchParams(filters);
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [filters, filtersHydrated]);

  const ownedDocuments = useMemo(
    () => docs?.data.filter((document) => document.ownerId === currentUserId) ?? [],
    [docs?.data, currentUserId],
  );
  const filterOptions = useMemo(
    () => buildDocumentFilterOptions(ownedDocuments),
    [ownedDocuments],
  );
  const quickViews = useMemo(
    () => buildDocumentQuickViewOptions(ownedDocuments),
    [ownedDocuments],
  );
  const searchSuggestions = useMemo(
    () => buildDocumentSearchSuggestions(ownedDocuments),
    [ownedDocuments],
  );
  const savedViews = useMemo(
    () =>
      buildDocumentSavedViewOptions(
        ownedDocuments,
        persistedSavedViewsQuery.isError
          ? localSavedViews
          : (persistedSavedViewsQuery.data ?? []),
      ),
    [
      ownedDocuments,
      localSavedViews,
      persistedSavedViewsQuery.data,
      persistedSavedViewsQuery.isError,
    ],
  );
  const activeSavedViewId = useMemo(
    () => findMatchingDocumentSavedViewId(savedViews, filters),
    [savedViews, filters],
  );
  const filtered = useMemo(
    () => filterAndSortDocuments(ownedDocuments, filters),
    [ownedDocuments, filters],
  );
  const activeFilterCount = countActiveDocumentFilters(filters);
  const emptyDescription =
    ownedDocuments.length === 0 && activeFilterCount === 0
      ? 'You have not created any documents yet.'
      : describeActiveDocumentFilters(filters, filterOptions);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  if (isLoading) return (
    <div>
      <PageHeader title="My Documents" subtitle="Documents you created and own." />
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

  function persistCustomSavedViews(nextViews: DocumentSavedView[]) {
    setLocalSavedViews(nextViews);
    window.localStorage.setItem(
      DOCUMENT_SAVED_VIEWS_STORAGE_KEY,
      serializeCustomDocumentSavedViews(nextViews),
    );
  }

  async function handleSaveCurrentView(label: string) {
    try {
      const nextView = await createPersistedDocumentSavedView({
        label,
        filters,
        scope: 'PRIVATE',
      });
      await qc.invalidateQueries({ queryKey: documentsKeys.savedViews() });
      toast.success(`Saved view "${nextView.label}".`);
    } catch {
      const nextView = createCustomDocumentSavedView(label, filters);
      const nextViews = [...localSavedViews, nextView].slice(-8);
      persistCustomSavedViews(nextViews);
      toast.success(`Saved view "${nextView.label}" locally.`);
    }
  }

  async function handleDeleteSavedView(id: string) {
    if (id.startsWith('custom-') || persistedSavedViewsQuery.isError) {
      const nextViews = localSavedViews.filter((view) => view.id !== id);
      persistCustomSavedViews(nextViews);
      toast.success('Saved view removed.');
      return;
    }

    try {
      await deletePersistedDocumentSavedView(id);
      await qc.invalidateQueries({ queryKey: documentsKeys.savedViews() });
      toast.success('Saved view removed.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="My Documents"
          subtitle="Documents you created and own."
          badge={
            activeFilterCount > 0 ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white bg-[var(--color-primary)]">
                {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
              </span>
            ) : null
          }
          actions={
            <Link href={ROUTES.DOCUMENTS_NEW} className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition">
              <FilePlus className="h-4 w-4" />
              New Document
            </Link>
          }
        />
      </div>

      <div className="animate-in delay-2">
        <DocumentFilters
          filters={filters}
          options={filterOptions}
          quickViews={quickViews}
          searchSuggestions={searchSuggestions}
          savedViews={savedViews}
          activeSavedViewId={activeSavedViewId}
          resultCount={filtered.length}
          totalCount={ownedDocuments.length}
          onApplySavedView={(view) => {
            setFilters(view.filters);
            setPage(1);
          }}
          onSaveCurrentView={handleSaveCurrentView}
          onDeleteSavedView={handleDeleteSavedView}
          onChange={(nextFilters) => {
            setFilters(nextFilters);
            setPage(1);
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="animate-in delay-3">
          <EmptyState
            title="No documents found"
            description={emptyDescription}
            icon="document"
            action={
              <Link href={ROUTES.DOCUMENTS_NEW} className="btn-primary rounded-xl px-4 py-2 text-sm font-medium text-white transition">
                Create Document
              </Link>
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

function loadCustomDocumentSavedViews(): DocumentSavedView[] {
  if (typeof window === 'undefined') return [];
  return parseCustomDocumentSavedViews(
    window.localStorage.getItem(DOCUMENT_SAVED_VIEWS_STORAGE_KEY),
  );
}
