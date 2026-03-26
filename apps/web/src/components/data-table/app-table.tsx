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
        className="overflow-hidden rounded-2xl border"
        style={{
          background: 'var(--table-surface-bg)',
          borderColor: 'var(--border-soft)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'var(--table-surface-shadow)',
        }}
      >
        <div className="animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 border-b"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border-soft)' }}
            />
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
      className={cn('overflow-hidden rounded-2xl border', className)}
      style={{
        background: 'var(--table-surface-bg)',
        borderColor: 'var(--border-soft)',
        backdropFilter: 'blur(8px)',
        boxShadow: 'var(--table-surface-shadow)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            style={{
              background: 'var(--table-header-bg)',
              borderBottom: '1px solid var(--table-header-border)',
            }}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--table-header-text)' }}
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
                  'border-b last:border-0',
                )}
                style={{
                  background: rowIndex % 2 === 0 ? 'transparent' : 'var(--table-row-alt-bg)',
                  borderColor: 'var(--table-row-border)',
                }}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-[var(--text-main)]"
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
