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
      <span className="text-[var(--text-muted)]">
        {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
      </span>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-xl border px-2 py-1 text-sm transition-all"
              style={{
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                borderColor: 'var(--input-border)',
              }}
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
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95',
              page <= 1
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[var(--bg-muted)]',
            )}
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-main)' }}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="whitespace-nowrap px-2 text-sm font-medium text-[var(--text-muted)]">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95',
              page >= totalPages
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[var(--bg-muted)]',
            )}
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-main)' }}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
