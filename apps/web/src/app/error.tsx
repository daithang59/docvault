'use client';

import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
      <div className="max-w-md space-y-4 p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--state-error-bg)', color: 'var(--state-error-text)' }}>
            <AlertTriangle size={32} />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-strong)]">Something went wrong</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
        <button
          onClick={reset}
          className="btn-primary rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
