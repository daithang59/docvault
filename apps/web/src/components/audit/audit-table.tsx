'use client';

import { AuditLogEntry } from '@/types/audit';
import { formatDateTime } from '@/lib/utils/date';
import { truncateMiddle } from '@/lib/utils/format';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils/cn';

interface AuditTableProps {
  data: AuditLogEntry[];
}

export function AuditTable({ data }: AuditTableProps) {
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
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
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
              <tr key={entry.eventId} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                  {formatDateTime(entry.timestamp)}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-[#1E293B] whitespace-nowrap">
                  {truncateMiddle(entry.actorId, 14)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(entry.actorRoles ?? []).map((r) => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded font-medium">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-[#1E293B] whitespace-nowrap uppercase">
                  {entry.action}
                </td>
                <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                  {entry.resourceType}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-[#64748B]">
                  <span title={entry.resourceId ?? ''}>{truncateMiddle(entry.resourceId ?? '—', 14)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ResultBadge result={entry.result} />
                </td>
                <td className="px-4 py-3 text-xs text-[#94A3B8] max-w-[140px] truncate" title={entry.reason ?? ''}>
                  {entry.reason ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-[#94A3B8]">
                  {entry.traceId ? truncateMiddle(entry.traceId, 12) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-[#F1F5F9] bg-[#F8FAFC]">
        <p className="text-xs text-[#94A3B8]">{data.length} record{data.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}

function ResultBadge({ result }: { result: string }) {
  const isSuccess = result === 'SUCCESS';
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
      isSuccess
        ? 'bg-[#DCFCE7] text-[#166534]'
        : 'bg-[#FEF2F2] text-[#B91C1C]'
    )}>
      {result}
    </span>
  );
}
