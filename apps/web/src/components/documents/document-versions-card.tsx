'use client';

import { useMemo, useState } from 'react';
import { DocumentVersion } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { formatBytes } from '@/lib/utils/file';
import { truncateMiddle } from '@/lib/utils/format';
import { AlertTriangle, CheckCircle, Download, Eye, FileText, GitCompareArrows, History, RotateCcw } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { getVersionPreviewPosture } from '@/features/documents/document-detail-presentation';
import { buildVersionDiff } from '@/features/documents/version-diff';
import { useRestoreDocumentVersion } from '@/features/documents/documents.hooks';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';

interface DocumentVersionsCardProps {
  docId: string;
  versions: DocumentVersion[];
  onDownload?: (docId: string, version: DocumentVersion) => void;
  onPreview?: (docId: string, version: DocumentVersion) => void;
  canDownload: boolean;
  canPreview: boolean;
  downloadDeniedReason?: string;
  previewDeniedReason?: string;
  canRestore?: boolean;
  currentVersion?: number;
}

export function DocumentVersionsCard({
  docId,
  versions,
  onDownload,
  onPreview,
  canDownload,
  canPreview,
  downloadDeniedReason,
  previewDeniedReason,
  canRestore = false,
  currentVersion,
}: DocumentVersionsCardProps) {
  const restore = useRestoreDocumentVersion(docId);
  const { session } = useAuth();
  const currentSub = session?.user.sub;
  const [selected, setSelected] = useState<number[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null);

  const creatorIds = useMemo(
    () =>
      [
        ...new Set(
          versions
            .map((v) => v.createdBy ?? v.uploadedById)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    [versions],
  );
  const { data: displayNames } = useOwnerDisplayNames(creatorIds);

  const latestVersion =
    currentVersion ??
    Math.max(0, ...versions.map((v) => v.versionNumber ?? v.version ?? 0));

  function toggleCompare(versionNumber: number) {
    setSelected((prev) => {
      if (prev.includes(versionNumber)) {
        return prev.filter((n) => n !== versionNumber);
      }
      return [...prev, versionNumber].slice(-2);
    });
  }

  const diff =
    selected.length === 2
      ? (() => {
          const a = versions.find(
            (v) => (v.versionNumber ?? v.version) === selected[0],
          );
          const b = versions.find(
            (v) => (v.versionNumber ?? v.version) === selected[1],
          );
          return a && b ? buildVersionDiff(a, b) : null;
        })()
      : null;

  const sorted = [...versions].sort(
    (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0)
  );

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Version History</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
        {versions.length > 0 && (previewDeniedReason || downloadDeniedReason) && (
          <div className="mt-3 space-y-1.5">
            {previewDeniedReason && <PolicyNote label="Preview" reason={previewDeniedReason} />}
            {downloadDeniedReason && <PolicyNote label="Download" reason={downloadDeniedReason} />}
          </div>
        )}
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
          {sorted.map((v) => {
            const previewPosture = getVersionPreviewPosture(v, {
              allowed: canPreview,
              reason: previewDeniedReason,
            });
            const previewSupported = previewPosture.state === 'supported';

            return (
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
                    {(() => {
                      const creatorId = v.createdBy ?? v.uploadedById;
                      if (!creatorId) return null;
                      const resolved =
                        (creatorId === currentSub && session?.user.displayName) ||
                        displayNames?.[creatorId]?.displayName ||
                        creatorId;
                      return (
                        <span title={creatorId}>By {resolved}</span>
                      );
                    })()}
                    <span>{formatDateTime(v.uploadedAt ?? v.createdAt ?? '')}</span>
                  </div>
                  <div
                    className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg border px-2 py-1 text-xs"
                    style={{
                      borderColor:
                        previewPosture.state === 'supported'
                          ? 'var(--status-published-border)'
                          : 'var(--status-pending-border)',
                      background:
                        previewPosture.state === 'supported'
                          ? 'var(--status-published-bg)'
                          : 'var(--status-pending-bg)',
                      color:
                        previewPosture.state === 'supported'
                          ? 'var(--status-published-text)'
                          : 'var(--status-pending-text)',
                    }}
                  >
                    {previewPosture.state === 'supported' ? (
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="font-medium">{previewPosture.label}:</span>{' '}
                      {previewPosture.reason}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canPreview && onPreview && previewSupported && (
                    <button
                      onClick={() => onPreview(docId, v)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      title="Preview this version"
                      aria-label="Preview this version"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {(!canPreview || !previewSupported) && (
                    <DisabledIconButton
                      icon={Eye}
                      label="Preview"
                      reason={previewPosture.reason}
                    />
                  )}
                  {canDownload && onDownload && (
                    <button
                      onClick={() => onDownload(docId, v)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      title="Download this version"
                      aria-label="Download this version"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {!canDownload && downloadDeniedReason && (
                    <DisabledIconButton
                      icon={Download}
                      label="Download"
                      reason={downloadDeniedReason}
                    />
                  )}
                  <label
                    className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs cursor-pointer"
                    style={{ color: 'var(--text-faint)' }}
                    title="Select to compare (pick two versions)"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                      checked={selected.includes(v.versionNumber ?? v.version ?? 0)}
                      onChange={() => toggleCompare(v.versionNumber ?? v.version ?? 0)}
                      aria-label={`Compare version ${v.versionNumber ?? v.version}`}
                    />
                    <GitCompareArrows className="h-3.5 w-3.5" />
                  </label>
                  {canRestore &&
                    (v.versionNumber ?? v.version ?? 0) !== latestVersion && (
                      <button
                        onClick={() =>
                          setRestoreTarget(v.versionNumber ?? v.version ?? 0)
                        }
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-faint)' }}
                        title="Restore this version"
                        aria-label={`Restore version ${v.versionNumber ?? v.version}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {diff && (
        <div
          className="border-t px-5 py-4"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
            <History className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            Comparing v{diff.fromVersion} to v{diff.toVersion}
            <span className="text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
              ({diff.changedCount} change{diff.changedCount === 1 ? '' : 's'})
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-soft)' }}>
            <table className="w-full text-left text-xs">
              <thead style={{ background: 'var(--table-header-bg)' }}>
                <tr>
                  <th className="px-3 py-2 font-semibold" style={{ color: 'var(--table-header-text)' }}>Field</th>
                  <th className="px-3 py-2 font-semibold" style={{ color: 'var(--table-header-text)' }}>v{diff.fromVersion}</th>
                  <th className="px-3 py-2 font-semibold" style={{ color: 'var(--table-header-text)' }}>v{diff.toVersion}</th>
                </tr>
              </thead>
              <tbody>
                {diff.fields.map((field) => (
                  <tr
                    key={field.label}
                    className="border-t"
                    style={{
                      borderColor: 'var(--table-row-border)',
                      background: field.changed ? 'var(--status-pending-bg)' : 'transparent',
                    }}
                  >
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{field.label}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-main)' }}>{field.from}</td>
                    <td className="px-3 py-2" style={{ color: field.changed ? 'var(--status-published-text)' : 'var(--text-main)' }}>{field.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        title={`Restore version ${restoreTarget ?? ''}`}
        description="This creates a new current version pointing to the selected version's file. History is preserved."
        confirmLabel="Restore version"
        loading={restore.isPending}
        onConfirm={async () => {
          if (restoreTarget !== null) {
            await restore.mutateAsync(restoreTarget);
            setRestoreTarget(null);
          }
        }}
      />
    </div>
  );
}

function PolicyNote({ label, reason }: { label: string; reason: string }) {
  return (
    <p
      className="rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed"
      style={{
        borderColor: 'var(--input-border)',
        background: 'var(--bg-muted)',
        color: 'var(--text-muted)',
      }}
    >
      <span className="font-medium">{label} blocked:</span> {reason}
    </p>
  );
}

function DisabledIconButton({
  icon: Icon,
  label,
  reason,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  reason: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      aria-label={`${label} unavailable: ${reason}`}
      className="cursor-not-allowed rounded-lg p-1.5 opacity-45"
      style={{ color: 'var(--text-faint)' }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
