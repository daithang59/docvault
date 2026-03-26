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
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: 'var(--table-surface-bg)',
        borderColor: 'var(--border-soft)',
        backdropFilter: 'blur(8px)',
        boxShadow: 'var(--table-surface-shadow)',
      }}
    >
      {/* Fake header */}
      <div
        className="flex gap-4 px-4 py-3 border-b"
        style={{ background: 'var(--table-header-bg)', borderColor: 'var(--table-header-border)' }}
      >
        {Array.from({ length: cols }).map((_, j) => (
          <div
            key={j}
            className="skeleton-shimmer h-3 rounded-full"
            style={{ flex: j === 0 ? '2' : '1', opacity: 0.5 }}
          />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--table-row-border)' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5"
            style={{
              background: i % 2 === 0 ? 'transparent' : 'var(--table-row-alt-bg)',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            {Array.from({ length: cols }).map((_, j) => (
              <div
                key={j}
                className="skeleton-shimmer h-4 rounded-lg"
                style={{ flex: j === 0 ? '2' : '1' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('overflow-hidden rounded-2xl border p-6', className)}
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="skeleton-shimmer h-5 w-1/3 rounded-lg" />
      <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded-lg" />
      <div className="skeleton-shimmer mt-2 h-4 w-1/2 rounded-lg" />
    </div>
  );
}
