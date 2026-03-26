import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)] text-[var(--text-muted)]">
            <FileQuestion size={32} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Page not found</h1>
          <p className="mt-1 text-[var(--text-muted)]">The page you&apos;re looking for doesn&apos;t exist.</p>
        </div>
        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
