'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { CheckCircle, XCircle, X, Eye, Clock, User, Tag, ArrowRight, ShieldCheck } from 'lucide-react';
import { useApproveDocument, useRejectDocument } from '@/features/workflow/workflow.hooks';
import { useWorkflowHistory } from '@/lib/hooks/use-workflow-history';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DocumentApprovalReadinessCard } from '@/components/documents/document-approval-readiness-card';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { getErrorMessage } from '@/lib/api/errors';
import { ROUTES } from '@/lib/constants/routes';
import { buildApprovalSla, type ApprovalSla } from '@/features/approvals/approval-sla';

const REJECT_REASON_PRESETS = [
  'Missing required metadata.',
  'Classification needs review.',
  'DLP findings need remediation.',
  'Retention evidence is incomplete.',
];

interface ApprovalReviewDrawerProps {
  doc: DocumentListItem | null;
  onClose: () => void;
}

export function ApprovalReviewDrawer({ doc, onClose }: ApprovalReviewDrawerProps) {
  const [confirmType, setConfirmType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: displayNames } = useOwnerDisplayNames(doc ? [doc.ownerId] : []);
  const ownerDisplay = doc
    ? (displayNames?.[doc.ownerId]?.displayName ?? doc.ownerDisplay ?? doc.ownerId ?? 'Unknown')
    : '';
  const sla = doc ? buildApprovalSla(doc) : null;

  const approve = useApproveDocument(doc?.id ?? '');
  const reject = useRejectDocument(doc?.id ?? '');
  const { data: history } = useWorkflowHistory(doc?.id ?? '');

  async function handleApprove() {
    if (!doc) return;
    try {
      await approve.mutateAsync(undefined);
      toast.success(TOAST_MESSAGES.APPROVED);
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleReject() {
    if (!doc) return;
    try {
      await reject.mutateAsync(rejectReason ? { reason: rejectReason } : undefined);
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 cursor-default backdrop-blur-sm"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col"
        style={{
          background: 'var(--bg-card)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* ── Top bar: title + close ──────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
            Review Document
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Section 1: Title + badges (one row) */}
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <StatusBadge status={doc.status} />
              <ClassificationBadge classification={doc.classification} />
            </div>
            <h3 className="text-base font-semibold leading-snug mb-1.5" style={{ color: 'var(--text-strong)' }}>
              {doc.title}
            </h3>
            {doc.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {truncateEnd(doc.description, 200)}
              </p>
            )}
          </div>

          {/* Section 2: Metadata — horizontal, 2 rows */}
          <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: 'var(--border-soft)' }}>
            {/* Row 1 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <User className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Owner
                </span>
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {ownerDisplay}
              </span>
            </div>
            {/* Row 2 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Updated
                </span>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-main)' }}>
                {formatDateTime(doc.updatedAt)}
              </span>
              <span className="text-xs ml-auto font-medium" style={{ color: 'var(--color-primary)' }}>
                v{doc.currentVersion ?? 1}
              </span>
            </div>
            {/* Row 3 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Created
                </span>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-main)' }}>
                {formatDateTime(doc.createdAt)}
              </span>
            </div>
          </div>

          {/* Section 3: Assignment and SLA */}
          {sla && (
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="mb-3 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Assignment
                </span>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {sla.assignment.label}
                    </p>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                      {sla.assignment.reason}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${slaBadgeClass(sla.tone)}`}>
                    {sla.stateLabel}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <ApprovalSlaMeta label="Queued" value={`${sla.queuedHours}h`} />
                  <ApprovalSlaMeta label="Due" value={formatDateTime(sla.dueAt)} />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Tags */}
          {doc.tags.length > 0 && (
            <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Tag className="h-3.5 w-3.5" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Tags
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Approval readiness */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <DocumentApprovalReadinessCard document={doc} compact />
          </div>

          {/* Section 6: Activity */}
          {history && history.length > 0 && (
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--text-faint)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  Activity
                </span>
              </div>
              <div className="space-y-2.5">
                {history.slice(0, 4).map((h) => (
                  <div key={h.id} className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: 'var(--color-primary)', marginTop: '7px' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold"
                          style={{
                            background: 'var(--status-pending-bg)',
                            color: 'var(--status-pending-text)',
                          }}
                        >
                          {h.action}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {h.fromStatus} → {h.toStatus}
                        </span>
                        <span className="text-[11px] ml-auto shrink-0" style={{ color: 'var(--text-faint)' }}>
                          {formatDateTime(h.createdAt)}
                        </span>
                      </div>
                      {h.reason && (
                        <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>
                          &ldquo;{h.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Action bar ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-5 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <Link
            href={ROUTES.DOCUMENT_DETAIL(doc.id)}
            className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--input-border)',
              color: 'var(--text-main)',
            }}
          >
            <Eye className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            Preview
          </Link>
          <button
            onClick={() => setConfirmType('reject')}
            className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--state-error-border)',
              background: 'var(--state-error-bg)',
              color: 'var(--state-error-text)',
            }}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
          <button
            onClick={() => setConfirmType('approve')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            <CheckCircle className="h-4 w-4" />
            Approve
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
          placeholder="Rejection reason (optional)..."
          rows={3}
          className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition"
          style={{
            borderColor: 'var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--input-text)',
          }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REJECT_REASON_PRESETS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setRejectReason(reason)}
              className="rounded-lg border px-2 py-1 text-xs font-medium transition hover:bg-[var(--bg-muted)]"
              style={{
                borderColor: 'var(--border-soft)',
                color: 'var(--text-muted)',
              }}
            >
              {reason}
            </button>
          ))}
        </div>
      </ConfirmDialog>
    </>
  );
}

function ApprovalSlaMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="mt-0.5" style={{ color: 'var(--text-main)' }}>
        {value}
      </p>
    </div>
  );
}

function slaBadgeClass(tone: ApprovalSla['tone']): string {
  if (tone === 'danger') {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  }

  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }

  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
}
