'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: TablePaginationProps) {
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  return (
    <div className={cn('flex items-center justify-between px-1 py-3 text-sm', className)}>
      <span className="text-slate-500">
        {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
      </span>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600',
              'hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-2 text-slate-600 font-medium whitespace-nowrap">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600',
              'hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
