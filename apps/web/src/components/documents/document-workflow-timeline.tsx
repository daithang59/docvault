'use client';

import { WorkflowHistoryEntry } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { Send, CheckCircle, XCircle, Archive } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

const ACTION_CONFIG = {
  SUBMIT: { icon: Send, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', label: 'Submitted' },
  APPROVE: { icon: CheckCircle, color: 'text-[#166534]', bg: 'bg-[#DCFCE7]', label: 'Approved' },
  REJECT: { icon: XCircle, color: 'text-[#B91C1C]', bg: 'bg-[#FEF2F2]', label: 'Rejected' },
  ARCHIVE: { icon: Archive, color: 'text-[#4B5563]', bg: 'bg-[#E5E7EB]', label: 'Archived' },
};

interface DocumentWorkflowTimelineProps {
  history: WorkflowHistoryEntry[];
}

export function DocumentWorkflowTimeline({ history }: DocumentWorkflowTimelineProps) {
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <h3 className="text-sm font-semibold text-[#0F172A]">Workflow Timeline</h3>
        <p className="text-xs text-[#94A3B8] mt-0.5">{history.length} transition{history.length !== 1 ? 's' : ''}</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No workflow history"
          description="History will appear after the document is submitted."
          icon="list"
          className="py-8"
        />
      ) : (
        <div className="px-5 py-4">
          <div className="relative">
            {/* Vertical line */}
            {sorted.length > 1 && (
              <div className="absolute left-4 top-8 bottom-8 w-px bg-[#E2E8F0]" />
            )}
            <div className="space-y-4">
              {sorted.map((entry, idx) => {
                const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.SUBMIT;
                const Icon = config.icon;
                return (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Icon */}
                    <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center z-10 ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#1E293B]">{config.label}</span>
                        <span className="text-xs text-[#94A3B8]">
                          {entry.fromStatus} → {entry.toStatus}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded font-medium">Latest</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-[#94A3B8]">
                        <span>By <span className="font-mono">{entry.actorId.slice(0, 8)}…</span></span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.reason && (
                        <p className="text-xs text-[#64748B] mt-1 italic">"{entry.reason}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
