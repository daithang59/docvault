'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Eye, Pencil, Send, CheckCircle, XCircle, Archive, Download } from 'lucide-react';
import Link from 'next/link';
import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { useAuth } from '@/lib/auth/auth-context';
import { canEditDocument, canSubmitDocument, canApproveDocument, canRejectDocument, canArchiveDocument, canDownloadDocument } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

interface DocumentsTableProps {
  data: DocumentListItem[];
  onSubmit?: (doc: DocumentListItem) => void;
  onApprove?: (doc: DocumentListItem) => void;
  onReject?: (doc: DocumentListItem) => void;
  onArchive?: (doc: DocumentListItem) => void;
  onDownload?: (doc: DocumentListItem) => void;
}

export function DocumentsTable({
  data,
  onSubmit,
  onApprove,
  onReject,
  onArchive,
  onDownload,
}: DocumentsTableProps) {
  const { session } = useAuth();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const columns: ColumnDef<DocumentListItem>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <SortableHeader label="Title" column={column} />
      ),
      cell: ({ row }) => (
        <div>
          <Link href={ROUTES.DOCUMENT_DETAIL(row.original.id)} className="text-[var(--text-main)] font-medium hover:text-[var(--color-primary)] transition-colors text-sm">
            {truncateEnd(row.original.title, 60)}
          </Link>
          {row.original.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.original.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {tag}
                </span>
              ))}
              {row.original.tags.length > 3 && (
                <span className="text-[10px] text-[var(--text-faint)]">+{row.original.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ),
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
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {row.original.ownerId.slice(0, 8)}…
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
    state: { sorting },
    onSortingChange: setSorting,
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
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-header-border)' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--table-header-text)' }}
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
                className="group border-b last:border-0 transition-all duration-150"
                style={{
                  borderColor: 'var(--table-row-border)',
                  background: rowIndex % 2 === 0 ? 'transparent' : 'var(--table-row-alt-bg)',
                }}
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
