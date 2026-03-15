'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
      <Loader2 className="h-7 w-7 animate-spin text-[#2563EB]" />
      <span className="text-sm text-[#64748B]">{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-[#F1F5F9] rounded flex-1"
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
    <div className={cn('p-6 space-y-3 animate-pulse', className)}>
      <div className="h-5 bg-[#F1F5F9] rounded w-1/3" />
      <div className="h-4 bg-[#F1F5F9] rounded w-2/3" />
      <div className="h-4 bg-[#F1F5F9] rounded w-1/2" />
    </div>
  );
}
