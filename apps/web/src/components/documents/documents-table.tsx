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
          <Link href={ROUTES.DOCUMENT_DETAIL(row.original.id)} className="text-[#1E293B] font-medium hover:text-[#2563EB] transition-colors text-sm">
            {truncateEnd(row.original.title, 60)}
          </Link>
          {row.original.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.original.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded">
                  {tag}
                </span>
              ))}
              {row.original.tags.length > 3 && (
                <span className="text-[10px] text-[#94A3B8]">+{row.original.tags.length - 3}</span>
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
        <span className="text-sm text-[#64748B] font-mono">v{row.original.currentVersion}</span>
      ),
    },
    {
      accessorKey: 'ownerId',
      header: 'Owner',
      cell: ({ row }) => (
        <span className="text-sm text-[#64748B] font-mono text-xs">
          {row.original.ownerId.slice(0, 8)}…
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => <SortableHeader label="Updated" column={column} />,
      cell: ({ row }) => (
        <span className="text-sm text-[#64748B]">{formatDateTime(row.original.updatedAt)}</span>
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
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                <div
                  className="absolute right-0 top-full mt-2 z-20 w-48 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xl"
                  style={{
                    background: 'rgba(255,255,255,0.97)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
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
      className="rounded-2xl border border-slate-200/70 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead
            style={{
              background: 'linear-gradient(180deg, #F8FAFC 0%, #F5F7FA 100%)',
              borderBottom: '1px solid rgba(226,232,240,0.7)',
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
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
                className="border-b border-slate-100/60 last:border-0 transition-all duration-150 group"
                style={{
                  background: rowIndex % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.3)',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 group-hover:bg-slate-50/80 transition-colors">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="px-4 py-3 border-t border-slate-100/60 flex items-center justify-between"
        style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #F5F7FA 100%)' }}
      >
        <p className="text-xs text-slate-400">
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
      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors group"
    >
      {label}
      {sorted === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-500" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3 text-blue-500" /> : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />}
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
      <Link href={href} onClick={onClick} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50/80 transition-colors rounded-xl mx-1.5 first:mt-1.5 last:mb-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        {label}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50/80 transition-colors rounded-xl mx-1.5 first:mt-1.5 last:mb-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      {label}
    </button>
  );
}
