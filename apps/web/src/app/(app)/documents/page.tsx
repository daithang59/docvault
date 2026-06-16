'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDocuments, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument, useDeleteDocument } from '@/lib/hooks/use-documents';
import { useAuth } from '@/lib/auth/auth-context';
import { getAnalyticsVisibility } from '@/lib/auth/permissions';
import { deleteDocument } from '@/lib/api/workflow';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { submitDocument, approveDocument, archiveDocument } from '@/lib/api/workflow';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { PageHeader } from '@/components/common/page-header';
import { DocumentsTable } from '@/components/documents/documents-table';
import { DocumentFilters } from '@/components/documents/document-filters';
import { DocumentFolderTree } from '@/components/documents/document-folder-tree';
import { DocumentPreviewPanel } from '@/components/documents/document-preview-panel';
import {
  ColumnBarChart,
  MetricTile,
  PriorityBarList,
  ScoreGauge,
  SegmentDonut,
} from '@/components/analytics/analytics-primitives';
import {
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
import {
  buildDocumentCommandCenter,
  filterDocumentQuickViewsByAnalyticsVisibility,
  filterDocumentSavedViewsByAnalyticsVisibility,
  filterDocumentSearchSuggestionsByAnalyticsVisibility,
  type DocumentCommandMetric,
} from '@/features/documents/document-command-center';
import { EmptyState } from '@/components/common/empty-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ProtectedAction } from '@/components/common/protected-action';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TablePagination } from '@/components/data-table/table-pagination';
import { DocumentListItem } from '@/types/document';
import { ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';
import { getErrorMessage, parseApiError } from '@/lib/api/errors';
import { DEFAULT_PAGE_SIZE } from '@/types/pagination';
import { scheduleDeferredAction } from '@/features/documents/deferred-action';
import {
  Archive,
  CheckSquare,
  FilePlus,
  FileText,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

export default function DocumentsPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: docs, isLoading, isError, refetch } = useDocuments();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<DocumentFiltersState>(() =>
    parseDocumentFiltersFromSearchParams(
      new URLSearchParams(searchParams.toString()),
    ),
  );
  const [localSavedViews, setLocalSavedViews] = useState<DocumentSavedView[]>(
    () => loadCustomDocumentSavedViews(),
  );
  const [targetDoc, setTargetDoc] = useState<DocumentListItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentListItem | null>(null);
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

  useEffect(() => {
    const params = serializeDocumentFiltersToSearchParams(filters);
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [filters]);

  const documents = useMemo(() => docs?.data ?? [], [docs?.data]);
  const filterOptions = useMemo(
    () => buildDocumentFilterOptions(documents),
    [documents],
  );
  const quickViews = useMemo(
    () => buildDocumentQuickViewOptions(documents),
    [documents],
  );
  const searchSuggestions = useMemo(
    () => buildDocumentSearchSuggestions(documents),
    [documents],
  );
  const savedViews = useMemo(
    () =>
      buildDocumentSavedViewOptions(
        documents,
        persistedSavedViewsQuery.isError
          ? localSavedViews
          : (persistedSavedViewsQuery.data ?? []),
      ),
    [
      documents,
      localSavedViews,
      persistedSavedViewsQuery.data,
      persistedSavedViewsQuery.isError,
    ],
  );
  const analyticsVisibility = useMemo(
    () => getAnalyticsVisibility(session),
    [session],
  );
  const visibleQuickViews = useMemo(
    () => filterDocumentQuickViewsByAnalyticsVisibility(quickViews, analyticsVisibility),
    [analyticsVisibility, quickViews],
  );
  const visibleSavedViews = useMemo(
    () => filterDocumentSavedViewsByAnalyticsVisibility(savedViews, analyticsVisibility),
    [analyticsVisibility, savedViews],
  );
  const visibleSearchSuggestions = useMemo(
    () =>
      filterDocumentSearchSuggestionsByAnalyticsVisibility(
        searchSuggestions,
        analyticsVisibility,
      ),
    [analyticsVisibility, searchSuggestions],
  );
  const commandCenter = useMemo(
    () =>
      buildDocumentCommandCenter(documents, visibleSavedViews, {
        analyticsVisibility,
      }),
    [analyticsVisibility, documents, visibleSavedViews],
  );
  const activeSavedViewId = useMemo(
    () => findMatchingDocumentSavedViewId(visibleSavedViews, filters),
    [visibleSavedViews, filters],
  );
  const filtered = useMemo(
    () => filterAndSortDocuments(documents, filters),
    [documents, filters],
  );
  const activeFilterCount = countActiveDocumentFilters(filters);
  const emptyDescription =
    documents.length === 0 && activeFilterCount === 0
      ? 'Create your first document to get started.'
      : describeActiveDocumentFilters(filters, filterOptions);

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

  async function runBulkAction(
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

  function scheduleBulkAction(
    docs: DocumentListItem[],
    action: (id: string) => Promise<unknown>,
    label: string,
  ) {
    if (docs.length === 0) return;
    const toastId = `bulk-${label}-${Date.now()}`;
    const deferred = scheduleDeferredAction(
      () => runBulkAction(docs, action, label),
      { delayMs: 5000 },
    );
    toast(`${label}: ${docs.length} document${docs.length === 1 ? '' : 's'}`, {
      id: toastId,
      description: 'Applying in 5s',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          if (deferred.cancel()) {
            toast.dismiss(toastId);
            toast.info(`${label} cancelled`);
          }
        },
      },
    });
  }

  function handleBulkAction(
    docs: DocumentListItem[],
    action: (id: string) => Promise<unknown>,
    label: string,
  ) {
    scheduleBulkAction(docs, action, label);
  }

  function handleBulkDelete(docs: DocumentListItem[]) {
    scheduleBulkAction(docs, (id) => deleteDocument(id), 'Delete');
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
          title="Documents"
          subtitle="Manage and review secure documents across their lifecycle."
          badge={
            activeFilterCount > 0 ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white bg-[var(--color-primary)]">
                {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
              </span>
            ) : null
          }
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

      <section
        aria-labelledby="documents-command-center"
        className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]"
      >
        <h2 id="documents-command-center" className="sr-only">
          Document control center
        </h2>
        <ScoreGauge
          className="animate-in delay-1 min-h-[180px]"
          description={commandCenter.controlGauge.description}
          href={commandCenter.controlGauge.href}
          label={commandCenter.controlGauge.label}
          tone={commandCenter.controlGauge.tone}
          value={commandCenter.controlGauge.value}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {commandCenter.metrics.map((metric) => {
            const Icon = DOCUMENT_METRIC_ICONS[metric.key];
            return (
              <MetricTile
                key={metric.key}
                className="animate-in delay-2"
                description={metric.description}
                href={metric.href}
                icon={<Icon className="h-5 w-5" />}
                label={metric.label}
                tone={metric.tone}
                value={metric.value}
              />
            );
          })}
        </div>
      </section>

      <section className="mb-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {commandCenter.classificationSegments.length > 0 ? (
          <SegmentDonut
            className="animate-in delay-2"
            label="Classification mix"
            segments={commandCenter.classificationSegments}
          />
        ) : null}
        <ColumnBarChart
          className="animate-in delay-3"
          label="Lifecycle pipeline"
          segments={commandCenter.lifecycleSegments}
        />
        <PriorityBarList
          className="animate-in delay-3"
          label="Attention cues"
          segments={commandCenter.attentionSegments}
        />
        {commandCenter.savedViewSegments.length > 0 ? (
          <PriorityBarList
            className="animate-in delay-3"
            label="Saved view load"
            segments={commandCenter.savedViewSegments}
          />
        ) : null}
      </section>

      <div className="animate-in delay-2">
        <DocumentFilters
          filters={filters}
          options={filterOptions}
          quickViews={visibleQuickViews}
          searchSuggestions={visibleSearchSuggestions}
          savedViews={visibleSavedViews}
          activeSavedViewId={activeSavedViewId}
          resultCount={filtered.length}
          totalCount={documents.length}
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:w-64 lg:shrink-0">
          <DocumentFolderTree
            documents={documents}
            selectedFolder={filters.folder}
            onSelect={(folder) => {
              setFilters({ ...filters, folder });
              setPage(1);
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="animate-in delay-3">
              <EmptyState
            title="No documents found"
          description={emptyDescription}
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
                  onRowClick={(doc) => setPreviewDoc(doc)}
                  activeRowId={previewDoc?.id ?? null}
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
        </div>
      </div>

      <DocumentPreviewPanel
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onSubmit={(doc) => { setTargetDoc(doc); setActionType('submit'); }}
        onApprove={(doc) => { setTargetDoc(doc); setActionType('approve'); }}
        onReject={(doc) => { setTargetDoc(doc); setActionType('reject'); }}
        onArchive={(doc) => { setTargetDoc(doc); setActionType('archive'); }}
        onDelete={(doc) => { setTargetDoc(doc); setActionType('delete'); }}
        onDownload={(doc) => download(doc.id)}
      />

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

const DOCUMENT_METRIC_ICONS: Record<DocumentCommandMetric['key'], LucideIcon> = {
  'total-documents': FileText,
  'pending-review': CheckSquare,
  'sensitive-documents': ShieldAlert,
  'retention-due-soon': Archive,
};

function loadCustomDocumentSavedViews(): DocumentSavedView[] {
  if (typeof window === 'undefined') return [];
  return parseCustomDocumentSavedViews(
    window.localStorage.getItem(DOCUMENT_SAVED_VIEWS_STORAGE_KEY),
  );
}
