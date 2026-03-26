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
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'var(--state-error-bg)' }}
      >
        <AlertCircle className="h-7 w-7" style={{ color: 'var(--state-error-text)' }} />
      </div>
      <h3 className="mb-1 text-base font-semibold text-[var(--text-strong)]">{title}</h3>
      {message && (
        <p className="mb-4 max-w-sm text-sm text-[var(--text-muted)]">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="retry-btn inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}
