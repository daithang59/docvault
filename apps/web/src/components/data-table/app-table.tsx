'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  PaginationState,
  SortingState,
  OnChangeFn,
  RowSelectionState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils/cn';

interface AppTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowClick?: (row: TData) => void;
  className?: string;
}

export function AppTable<TData>({
  data,
  columns,
  isLoading,
  emptyState,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  className,
}: AppTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: {
      ...(pagination ? { pagination } : {}),
      ...(sorting ? { sorting } : {}),
      ...(rowSelection ? { rowSelection } : {}),
    },
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
  });

  if (isLoading) {
    return (
      <div
      className="rounded-2xl border border-slate-200/70 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
        <div className="animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-slate-100 bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn('rounded-2xl border border-slate-200/70 overflow-hidden', className)}
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            style={{
              background: 'linear-gradient(180deg, #F8FAFC 0%, #F5F7FA 100%)',
              borderBottom: '1px solid rgba(226,232,240,0.7)',
            }}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={cn(
                  'transition-all duration-150',
                  onRowClick && 'cursor-pointer',
                  'border-b border-slate-100/60 last:border-0',
                )}
                style={{
                  background: rowIndex % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)',
                }}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-slate-700"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
