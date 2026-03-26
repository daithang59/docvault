'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <div className="relative">
        <Loader2
          className="h-7 w-7 animate-spin"
          style={{ color: 'var(--color-primary)', filter: 'drop-shadow(0 0 8px var(--color-primary-glow))' }}
        />
      </div>
      <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 rounded-xl animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="skeleton-shimmer h-4 rounded-lg flex-1"
              style={{ maxWidth: j === 0 ? '200px' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('overflow-hidden rounded-2xl border p-6', className)}
      style={{
        background: 'var(--surface-overlay-strong)',
        borderColor: 'var(--border-soft)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="skeleton-shimmer h-5 w-1/3 rounded-lg" />
      <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded-lg" />
      <div className="skeleton-shimmer mt-2 h-4 w-1/2 rounded-lg" />
    </div>
  );
}
