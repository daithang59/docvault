'use client';

import { AuditLogEntry } from '@/types/audit';
import { formatDateTime } from '@/lib/utils/date';
import { truncateMiddle } from '@/lib/utils/format';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils/cn';

interface AuditTableProps {
  data: AuditLogEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export function AuditTable({ data, total = 0, page = 1, pageSize = 20 }: AuditTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No audit records"
        description="No events match your current filters."
        icon="audit"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-subtle)' }}>
              <Th>Timestamp</Th>
              <Th>Actor</Th>
              <Th>Roles</Th>
              <Th>Action</Th>
              <Th>Resource Type</Th>
              <Th>Resource ID</Th>
              <Th>Result</Th>
              <Th>Reason</Th>
              <Th>Trace ID</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.eventId} className="border-b transition-colors hover:bg-[var(--bg-muted)]/35" style={{ borderColor: 'var(--border-soft)' }}>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">
                  {formatDateTime(entry.timestamp)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-main)]">
                  {truncateMiddle(entry.actorId, 14)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(entry.actorRoles ?? []).map((r) => (
                      <span key={r} className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase text-[var(--text-main)]">
                  {entry.action}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">
                  {entry.resourceType}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                  <span title={entry.resourceId ?? ''}>{truncateMiddle(entry.resourceId ?? '—', 14)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ResultBadge result={entry.result} />
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-xs text-[var(--text-faint)]" title={entry.reason ?? ''}>
                  {entry.reason ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-faint)]">
                  {entry.traceId ? truncateMiddle(entry.traceId, 12) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t bg-[var(--bg-subtle)] px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        {total === 0 ? (
          <p className="text-xs text-[var(--text-faint)]">No records</p>
        ) : (
          <p className="text-xs text-[var(--text-faint)]">
            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} records
          </p>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </th>
  );
}

function ResultBadge({ result }: { result: string }) {
  const isSuccess = result === 'SUCCESS';
  return (
    <span className={cn(
      'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold',
      isSuccess
        ? 'bg-[var(--status-published-bg)] text-[var(--status-published-text)]'
        : 'bg-[var(--state-error-bg)] text-[var(--state-error-text)]'
    )}>
      {result}
    </span>
  );
}
