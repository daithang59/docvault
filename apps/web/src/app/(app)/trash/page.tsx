'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { useTrash, useRestoreFromTrash } from '@/features/documents/documents.hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { hasAnyRole } from '@/lib/auth/roles';
import { formatDateTime } from '@/lib/utils/date';

export default function TrashPage() {
  const { session } = useAuth();
  const canUseTrash = hasAnyRole(session, ['editor', 'admin']);
  const trashQuery = useTrash();
  const restore = useRestoreFromTrash();

  if (!canUseTrash) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Editor or Admin role to view deleted documents."
      />
    );
  }

  if (trashQuery.isLoading) return <LoadingState label="Loading trash..." />;
  if (trashQuery.isError) {
    return (
      <ErrorState
        message="Failed to load trash."
        onRetry={() => trashQuery.refetch()}
      />
    );
  }

  const items = trashQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Trash"
        subtitle="Deleted documents can be restored before their recovery window ends."
      />

      {items.length === 0 ? (
        <EmptyState
          icon="document"
          title="Trash is empty"
          description="Deleted documents will appear here until their recovery window elapses."
        />
      ) : (
        <section
          className="overflow-hidden rounded-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead
                style={{
                  background: 'var(--table-header-bg)',
                  borderBottom: '1px solid var(--table-header-border)',
                }}
              >
                <tr>
                  <Th>Document</Th>
                  <Th>Deleted</Th>
                  <Th>Recovery</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.docId}
                    className="border-b last:border-0"
                    style={{ borderColor: 'var(--table-row-border)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-[var(--text-faint)]" />
                        <span className="text-sm font-medium text-[var(--text-main)]">
                          {item.title}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ClassificationBadge classification={item.classification as never} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {item.deletedAt ? formatDateTime(item.deletedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.recoverable ? (
                        <span className="text-[var(--text-muted)]">
                          {item.daysUntilPurge} day{item.daysUntilPurge === 1 ? '' : 's'} left
                        </span>
                      ) : (
                        <span className="text-[var(--state-error-text)]">Recovery window elapsed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!item.recoverable || restore.isPending}
                        onClick={() => restore.mutate(item.docId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-text)]">
      {children}
    </th>
  );
}
