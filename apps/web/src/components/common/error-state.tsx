'use client';

import { AlertCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2]">
        <AlertCircle className="h-7 w-7 text-[#DC2626]" />
      </div>
      <h3 className="text-base font-semibold text-[#1E293B] mb-1">{title}</h3>
      {message && (
        <p className="text-sm text-[#64748B] max-w-sm mb-4">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}
