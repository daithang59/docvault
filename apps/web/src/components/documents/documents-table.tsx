'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Eye, Pencil, Send, CheckCircle, XCircle, Archive, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd, formatOwnerName } from '@/lib/utils/format';
import { useAuth } from '@/lib/auth/auth-context';
import { canEditDocument, canSubmitDocument, canApproveDocument, canRejectDocument, canArchiveDocument, canDownloadDocument, canDeleteDocument } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

interface DocumentsTableProps {
  data: DocumentListItem[];
  enableSelection?: boolean;
  onSubmit?: (doc: DocumentListItem) => void;
  onApprove?: (doc: DocumentListItem) => void;
  onReject?: (doc: DocumentListItem) => void;
  onArchive?: (doc: DocumentListItem) => void;
  onDelete?: (doc: DocumentListItem) => void;
  onBulkDelete?: (docs: DocumentListItem[]) => void;
  onDownload?: (doc: DocumentListItem) => void;
  onBulkSubmit?: (docs: DocumentListItem[]) => void;
  onBulkArchive?: (docs: DocumentListItem[]) => void;
  onBulkApprove?: (docs: DocumentListItem[]) => void;
}

export function DocumentsTable({
  data,
  enableSelection = false,
  onSubmit,
  onApprove,
  onReject,
  onArchive,
  onDelete,
  onBulkDelete,
  onDownload,
  onBulkSubmit,
  onBulkArchive,
  onBulkApprove,
}: DocumentsTableProps) {
  const { session } = useAuth();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowEnter = useCallback((id: string) => {
    hoverTimer.current = setTimeout(() => setHoveredRow(id), 350);
  }, []);
  const handleRowLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredRow(null);
  }, []);

  const selectedDocs = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => data[parseInt(key)])
      .filter(Boolean);
  }, [rowSelection, data]);

  const bulkSubmittable = useMemo(
    () => selectedDocs.filter((d) => canSubmitDocument(session, d)),
    [selectedDocs, session],
  );
  const bulkArchivable = useMemo(
    () => selectedDocs.filter((d) => canArchiveDocument(session, d)),
    [selectedDocs, session],
  );
  const bulkApprovable = useMemo(
    () => selectedDocs.filter((d) => canApproveDocument(session, d)),
    [selectedDocs, session],
  );
  const bulkDeletable = useMemo(
    () => selectedDocs.filter((d) => canDeleteDocument(session, d)),
    [selectedDocs, session],
  );

  const columns: ColumnDef<DocumentListItem>[] = [
    // Checkbox column (only when selection enabled)
    ...(enableSelection
      ? [
          {
            id: 'select',
            header: ({ table }: any) => (
              <input
                type="checkbox"
                checked={table.getIsAllPageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
                className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--color-primary)] cursor-pointer"
                aria-label="Select all"
              />
            ),
            cell: ({ row }: any) => (
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
                className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--color-primary)] cursor-pointer"
                aria-label="Select row"
              />
            ),
            size: 40,
          } as ColumnDef<DocumentListItem>,
        ]
      : []),
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <SortableHeader label="Title" column={column} />
      ),
      cell: ({ row }) => {
        const doc = row.original;
        const isHovered = hoveredRow === doc.id;
        return (
          <div className="relative">
            <Link href={ROUTES.DOCUMENT_DETAIL(doc.id)} className="text-[var(--text-main)] font-medium hover:text-[var(--color-primary)] transition-colors text-sm">
              {truncateEnd(doc.title, 60)}
            </Link>
            {doc.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {doc.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                    {tag}
                  </span>
                ))}
                {doc.tags.length > 3 && (
                  <span className="text-[10px] text-[var(--text-faint)]">+{doc.tags.length - 3}</span>
                )}
              </div>
            )}
            {/* Hover preview tooltip */}
            {isHovered && doc.description && (
              <div
                className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border p-3 animate-fade"
                style={{
                  background: 'var(--surface-overlay-strong)',
                  borderColor: 'var(--surface-border)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: 'var(--surface-shadow-lg)',
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-main)' }}>
                  {doc.description.length > 150 ? doc.description.slice(0, 150) + '…' : doc.description}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  <span>Owner: <span className="font-mono">{doc.ownerId ? formatOwnerName(doc.ownerId) : 'Unknown'}</span></span>
                  <span>{formatDateTime(doc.updatedAt)}</span>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'classification',
      header: 'Classification',
      cell: ({ row }) => <ClassificationBadge classification={(row.original.classificationLevel ?? row.original.classification) as import('@/types/enums').ClassificationLevel} />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <SortableHeader label="Status" column={column} />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'currentVersion',
      header: 'Version',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-[var(--text-muted)]">v{row.original.currentVersion}</span>
      ),
    },
    {
      accessorKey: 'ownerId',
      header: 'Owner',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--text-muted)]">
          {row.original.ownerId ? formatOwnerName(row.original.ownerId) : 'Unknown'}
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => <SortableHeader label="Updated" column={column} />,
      cell: ({ row }) => (
        <span className="text-sm text-[var(--text-muted)]">{formatDateTime(row.original.updatedAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const doc = row.original;
        const isMenuOpen = activeMenu === doc.id;

        return (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveMenu(isMenuOpen ? null : doc.id); }}
              className="rounded-xl p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] active:scale-95"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                <div
                  className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border"
                  style={{
                    background: 'var(--surface-overlay-strong)',
                    borderColor: 'var(--surface-border)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    boxShadow: 'var(--surface-shadow-lg)',
                  }}
                >
                  <ActionMenuItem icon={Eye} label="View" href={ROUTES.DOCUMENT_DETAIL(doc.id)} onClick={() => setActiveMenu(null)} />
                  {canEditDocument(session, doc) && (
                    <ActionMenuItem icon={Pencil} label="Edit" href={ROUTES.DOCUMENT_EDIT(doc.id)} onClick={() => setActiveMenu(null)} />
                  )}
                  {canSubmitDocument(session, doc) && onSubmit && (
                    <ActionMenuItem icon={Send} label="Submit" onClick={() => { setActiveMenu(null); onSubmit(doc); }} />
                  )}
                  {canApproveDocument(session, doc) && onApprove && (
                    <ActionMenuItem icon={CheckCircle} label="Approve" onClick={() => { setActiveMenu(null); onApprove(doc); }} />
                  )}
                  {canRejectDocument(session, doc) && onReject && (
                    <ActionMenuItem icon={XCircle} label="Reject" onClick={() => { setActiveMenu(null); onReject(doc); }} />
                  )}
                  {canArchiveDocument(session, doc) && onArchive && (
                    <ActionMenuItem icon={Archive} label="Archive" onClick={() => { setActiveMenu(null); onArchive(doc); }} />
                  )}
                  {canDownloadDocument(session, doc) && onDownload && (
                    <ActionMenuItem icon={Download} label="Download" onClick={() => { setActiveMenu(null); onDownload(doc); }} />
                  )}
                  {canDeleteDocument(session, doc) && onDelete && (
                    <ActionMenuItem icon={Trash2} label="Delete" onClick={() => { setActiveMenu(null); onDelete(doc); }} />
                  )}
                </div>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: 'var(--table-surface-bg)',
        borderColor: 'var(--border-soft)',
        backdropFilter: 'blur(8px)',
        boxShadow: 'var(--table-surface-shadow)',
      }}
    >
      {/* Bulk action bar */}
      {enableSelection && selectedDocs.length > 0 && (
        <div
          className="flex items-center gap-3 border-b px-4 py-2.5 animate-fade"
          style={{ background: 'var(--color-primary-bg)', borderColor: 'var(--border-soft)' }}
        >
          <span className="text-sm font-medium text-[var(--color-primary)]">
            {selectedDocs.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkSubmittable.length > 0 && onBulkSubmit && (
              <button
                onClick={() => { onBulkSubmit(bulkSubmittable); setRowSelection({}); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors btn-primary text-white"
              >
                <Send className="h-3 w-3" />
                Submit ({bulkSubmittable.length})
              </button>
            )}
            {bulkApprovable.length > 0 && onBulkApprove && (
              <button
                onClick={() => { onBulkApprove(bulkApprovable); setRowSelection({}); }}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--status-published-border)] bg-[var(--status-published-bg)] px-3 py-1.5 text-xs font-medium text-[var(--status-published-text)] transition-colors hover:brightness-95"
              >
                <CheckCircle className="h-3 w-3" />
                Approve ({bulkApprovable.length})
              </button>
            )}
            {bulkArchivable.length > 0 && onBulkArchive && (
              <button
                onClick={() => { onBulkArchive(bulkArchivable); setRowSelection({}); }}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
              >
                <Archive className="h-3 w-3" />
                Archive ({bulkArchivable.length})
              </button>
            )}
            {bulkDeletable.length > 0 && onBulkDelete && (
              <button
                onClick={() => { onBulkDelete(bulkDeletable); setRowSelection({}); }}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-3 py-1.5 text-xs font-medium text-[var(--state-error-text)] transition-colors hover:brightness-95"
              >
                <Trash2 className="h-3 w-3" />
                Delete ({bulkDeletable.length})
              </button>
            )}
          </div>
          <button
            onClick={() => setRowSelection({})}
            className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-header-border)' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--table-header-text)', ...(header.id === 'select' ? { width: 40 } : {}) }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={`group border-b last:border-0 transition-all duration-150 ${row.getIsSelected() ? 'ring-1 ring-inset ring-[var(--color-primary)]/20' : ''}`}
                style={{
                  borderColor: 'var(--table-row-border)',
                  background: row.getIsSelected()
                    ? 'var(--color-primary-bg)'
                    : rowIndex % 2 === 0
                      ? 'transparent'
                      : 'var(--table-row-alt-bg)',
                }}
                onMouseEnter={() => handleRowEnter(row.original.id)}
                onMouseLeave={handleRowLeave}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 transition-colors group-hover:bg-[var(--bg-muted)]/30">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'var(--table-row-border)', background: 'var(--table-header-bg)' }}>
        <p className="text-xs text-[var(--text-muted)]">
          {table.getRowModel().rows.length} document{table.getRowModel().rows.length !== 1 ? 's' : ''}
          {enableSelection && selectedDocs.length > 0 && (
            <span className="text-[var(--color-primary)]"> · {selectedDocs.length} selected</span>
          )}
        </p>
      </div>
    </div>
  );
}

function SortableHeader({ label, column }: { label: string; column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: () => void } }) {
  const sorted = column.getIsSorted();
  return (
    <button
      onClick={column.toggleSorting}
      className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-text)] transition-colors hover:text-[var(--text-main)]"
    >
      {label}
      {sorted === 'asc' ? <ArrowUp className="h-3 w-3 text-[var(--color-primary)]" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3 text-[var(--color-primary)]" /> : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 text-[var(--text-faint)] transition-opacity" />}
    </button>
  );
}

function ActionMenuItem({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  if (href) {
    return (
      <Link href={href} onClick={onClick} className="mx-1.5 first:mt-1.5 last:mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]/70">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        {label}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="mx-1.5 first:mt-1.5 last:mb-1.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]/70">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
      {label}
    </button>
  );
}
