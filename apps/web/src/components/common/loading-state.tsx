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
      <div className="relative">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" style={{ filter: 'drop-shadow(0 0 8px rgba(37,99,235,0.4))' }} />
      </div>
      <span className="text-sm text-slate-400 font-medium">{label}</span>
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
              className="h-4 rounded-lg flex-1"
              style={{
                maxWidth: j === 0 ? '200px' : undefined,
                background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
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
      className={cn('p-6 space-y-3 animate-pulse rounded-2xl border border-slate-200/60', className)}
      style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div className="h-5 rounded-lg w-1/3" style={{ background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div className="h-4 rounded-lg w-2/3" style={{ background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div className="h-4 rounded-lg w-1/2" style={{ background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
    </div>
  );
}
