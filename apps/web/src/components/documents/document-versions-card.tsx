'use client';

import { DocumentVersion } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { formatBytes } from '@/lib/utils/file';
import { truncateMiddle } from '@/lib/utils/format';
import { Download, Eye, FileText } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

interface DocumentVersionsCardProps {
  docId: string;
  versions: DocumentVersion[];
  onDownload?: () => void;
  onPreview?: (docId: string, version: DocumentVersion) => void;
  canDownload: boolean;
  canPreview: boolean;
}

export function DocumentVersionsCard({ docId, versions, onDownload, onPreview, canDownload, canPreview }: DocumentVersionsCardProps) {
  const sorted = [...versions].sort(
    (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
  );

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Version History</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No versions yet"
          description="Upload a file to create the first version."
          icon="document"
          className="py-8"
        />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {sorted.map((v) => (
            <div key={v.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-card-hover)]">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--stat-total-bg)' }}
              >
                <FileText className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-medium text-white px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    v{v.versionNumber ?? v.version ?? 1}
                  </span>
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>{v.filename}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-faint)' }}>
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
              <div className="flex items-center gap-1 shrink-0">
                {canPreview && onPreview && (
                  <button
                    onClick={() => onPreview(docId, v)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    title="Preview this version"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                {canDownload && onDownload && (
                  <button
                    onClick={() => onDownload()}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    title="Download this version"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
