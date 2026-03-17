'use client';

import { DocumentVersion } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { formatBytes } from '@/lib/utils/file';
import { truncateMiddle } from '@/lib/utils/format';
import { Download, FileText } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

interface DocumentVersionsCardProps {
  versions: DocumentVersion[];
  onDownload?: () => void;
  canDownload: boolean;
}

export function DocumentVersionsCard({ versions, onDownload, canDownload }: DocumentVersionsCardProps) {
  const sorted = [...versions].sort(
    (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
  );

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <h3 className="text-sm font-semibold text-[#0F172A]">Version History</h3>
        <p className="text-xs text-[#94A3B8] mt-0.5">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No versions yet"
          description="Upload a file to create the first version."
          icon="document"
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-[#F8FAFC]">
          {sorted.map((v) => (
            <div key={v.id} className="flex items-start gap-3 px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
              <div className="h-9 w-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white bg-[#2563EB] px-1.5 py-0.5 rounded">
                    v{v.versionNumber ?? v.version ?? 1}
                  </span>
                  <span className="text-sm font-medium text-[#1E293B] truncate">{v.filename}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8]">
                  {(v.fileSize ?? v.size) != null && (
                    <span>{formatBytes((v.fileSize ?? v.size)!)}</span>
                  )}
                  {(v.mimeType ?? v.contentType) && (
                    <span>{v.mimeType ?? v.contentType}</span>
                  )}
                  {v.checksum && (
                    <span title={v.checksum}>SHA: {truncateMiddle(v.checksum, 12)}</span>
                  )}
                  <span>{formatDateTime(v.uploadedAt ?? v.createdAt ?? '')}</span>
                </div>
              </div>
              {canDownload && onDownload && (
                <button
                  onClick={() => onDownload()}
                  className="shrink-0 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                  title="Download this version"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
