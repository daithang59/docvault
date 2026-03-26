'use client';

import { useState } from 'react';
import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { useApproveDocument, useRejectDocument } from '@/lib/hooks/use-documents';
import { useWorkflowHistory } from '@/lib/hooks/use-workflow-history';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { getErrorMessage } from '@/lib/api/errors';

interface ApprovalReviewDrawerProps {
  doc: DocumentListItem | null;
  onClose: () => void;
}

export function ApprovalReviewDrawer({ doc, onClose }: ApprovalReviewDrawerProps) {
  const [confirmType, setConfirmType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const approve = useApproveDocument(doc?.id ?? '');
  const reject = useRejectDocument(doc?.id ?? '');
  const { data: history } = useWorkflowHistory(doc?.id ?? '');

  async function handleApprove() {
    if (!doc) return;
    try {
      await approve.mutateAsync();
      toast.success(TOAST_MESSAGES.APPROVED);
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleReject() {
    if (!doc) return;
    try {
      await reject.mutateAsync(rejectReason || undefined);
      toast.success(TOAST_MESSAGES.REJECTED);
      setRejectReason('');
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  if (!doc) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', boxShadow: 'var(--surface-shadow-lg)' }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">Review Document</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge status={doc.status} />
              <ClassificationBadge classification={(doc.classificationLevel ?? doc.classification) as import('@/types/enums').ClassificationLevel} />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-strong)]">{doc.title}</h3>
            {doc.description && (
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">{truncateEnd(doc.description, 200)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--bg-subtle)] p-4">
            <InfoItem label="Owner" value={doc.ownerId.slice(0, 12) + '…'} mono />
            <InfoItem label="Version" value={`v${doc.currentVersion}`} />
            <InfoItem label="Updated" value={formatDateTime(doc.updatedAt)} />
            <InfoItem label="Created" value={formatDateTime(doc.createdAt)} />
          </div>

          {doc.tags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span key={tag} className="rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 text-xs text-[var(--color-primary)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {history && history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Recent History</p>
              <div className="space-y-2">
                {history.slice(0, 3).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-medium text-[var(--text-muted)]">{h.action}</span>
                    <span className="text-[var(--text-faint)]">{h.fromStatus} → {h.toStatus}</span>
                    <span className="ml-auto text-[var(--text-faint)]">{formatDateTime(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t px-6 py-4" style={{ borderColor: 'var(--border-soft)' }}>
          <button
            onClick={() => setConfirmType('approve')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--status-published-border)] bg-[var(--status-published-bg)] py-2.5 text-sm font-medium text-[var(--status-published-text)] transition hover:brightness-95"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => setConfirmType('reject')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--state-error-border)] bg-[var(--state-error-bg)] py-2.5 text-sm font-medium text-[var(--state-error-text)] transition hover:brightness-95"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmType === 'approve'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Approve Document"
        description="Document will be published."
        confirmLabel="Approve"
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={confirmType === 'reject'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Reject Document"
        description="Document will return to Draft."
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (optional)..."
          rows={3}
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:border-[var(--border-focus)]"
        />
      </ConfirmDialog>
    </>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className={`text-[var(--text-main)] ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  );
}
