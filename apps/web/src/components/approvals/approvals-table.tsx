'use client';

import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { Eye } from 'lucide-react';

interface ApprovalsTableProps {
  data: DocumentListItem[];
  onReview: (doc: DocumentListItem) => void;
}

export function ApprovalsTable({ data, onReview }: ApprovalsTableProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <Th>Title</Th>
              <Th>Classification</Th>
              <Th>Owner</Th>
              <Th>Version</Th>
              <Th>Updated</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                onClick={() => onReview(doc)}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#1E293B]">{truncateEnd(doc.title, 55)}</p>
                  {doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {doc.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded">{t}</span>
                      ))}
                      {doc.tags.length > 2 && <span className="text-[10px] text-[#94A3B8]">+{doc.tags.length - 2}</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><ClassificationBadge classification={doc.classification} /></td>
                <td className="px-4 py-3 text-xs font-mono text-[#64748B]">{doc.ownerId.slice(0, 10)}…</td>
                <td className="px-4 py-3 text-sm text-[#64748B] font-mono">v{doc.currentVersion}</td>
                <td className="px-4 py-3 text-sm text-[#64748B] whitespace-nowrap">{formatDateTime(doc.updatedAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onReview(doc); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-[#F1F5F9] bg-[#F8FAFC]">
        <p className="text-xs text-[#94A3B8]">{data.length} pending document{data.length !== 1 ? 's' : ''}</p>
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
