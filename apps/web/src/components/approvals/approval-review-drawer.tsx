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
import { ApiError } from '@/types/api';

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
      toast.error(e instanceof ApiError ? e.message : 'Failed to approve.');
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
      toast.error(e instanceof ApiError ? e.message : 'Failed to reject.');
    }
  }

  if (!doc) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-semibold text-[#0F172A]">Review Document</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#1E293B] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <StatusBadge status={doc.status} />
              <ClassificationBadge classification={(doc.classificationLevel ?? doc.classification) as import('@/types/enums').ClassificationLevel} />
            </div>
            <h3 className="text-lg font-semibold text-[#0F172A] mb-1">{doc.title}</h3>
            {doc.description && (
              <p className="text-sm text-[#64748B] leading-relaxed">{truncateEnd(doc.description, 200)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-[#F8FAFC] rounded-xl p-4">
            <InfoItem label="Owner" value={doc.ownerId.slice(0, 12) + '…'} mono />
            <InfoItem label="Version" value={`v${doc.currentVersion}`} />
            <InfoItem label="Updated" value={formatDateTime(doc.updatedAt)} />
            <InfoItem label="Created" value={formatDateTime(doc.createdAt)} />
          </div>

          {/* Tags */}
          {doc.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#64748B] mb-2 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workflow history */}
          {history && history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#64748B] mb-2 uppercase tracking-wide">Recent History</p>
              <div className="space-y-2">
                {history.slice(0, 3).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded font-medium">{h.action}</span>
                    <span className="text-[#94A3B8]">{h.fromStatus} → {h.toStatus}</span>
                    <span className="text-[#94A3B8] ml-auto">{formatDateTime(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-2">
          <button
            onClick={() => setConfirmType('approve')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-[#86EFAC] text-[#166534] text-sm font-medium hover:bg-[#DCFCE7] transition"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => setConfirmType('reject')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-[#FCA5A5] text-[#B91C1C] text-sm font-medium hover:bg-[#FEF2F2] transition"
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
          className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl resize-none outline-none focus:border-[#2563EB] transition"
        />
      </ConfirmDialog>
    </>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-[#94A3B8] uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-[#1E293B] ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
