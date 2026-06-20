'use client';

import { useEffect, useId, useRef, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  Archive,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Lock,
  Pencil,
  Send,
  Shield,
  ShieldAlert,
  Tag,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { DocumentListItem } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { useAuth } from '@/lib/auth/auth-context';
import {
  canEditDocument,
  canSubmitDocument,
  canApproveDocument,
  canRejectDocument,
  canArchiveDocument,
  canDeleteDocument,
  getExplainableDocumentAccessDecision,
} from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/constants/routes';

interface DocumentPreviewPanelProps {
  doc: DocumentListItem | null;
  onClose: () => void;
  onSubmit?: (doc: DocumentListItem) => void;
  onApprove?: (doc: DocumentListItem) => void;
  onReject?: (doc: DocumentListItem) => void;
  onArchive?: (doc: DocumentListItem) => void;
  onDelete?: (doc: DocumentListItem) => void;
  onDownload?: (doc: DocumentListItem) => void;
}

export function DocumentPreviewPanel({
  doc,
  onClose,
  onSubmit,
  onApprove,
  onReject,
  onArchive,
  onDelete,
  onDownload,
}: DocumentPreviewPanelProps) {
  const { session } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const { data: displayNames } = useOwnerDisplayNames(doc ? [doc.ownerId] : []);
  const ownerDisplay = doc
    ? (displayNames?.[doc.ownerId]?.displayName ?? doc.ownerDisplay ?? doc.ownerId ?? 'Unknown')
    : '';

  const documentId = doc?.id;

  useEffect(() => {
    if (!documentId) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [documentId]);

  useEffect(() => {
    if (!doc) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [doc, onClose]);

  if (!doc) return null;

  const downloadDecision = getExplainableDocumentAccessDecision(session, doc, 'download');

  const actions: PreviewAction[] = [];
  if (canSubmitDocument(session, doc) && onSubmit) {
    actions.push({ key: 'submit', label: 'Submit', icon: Send, onClick: () => onSubmit(doc) });
  }
  if (canApproveDocument(session, doc) && onApprove) {
    actions.push({ key: 'approve', label: 'Approve', icon: CheckCircle, tone: 'success', onClick: () => onApprove(doc) });
  }
  if (canRejectDocument(session, doc) && onReject) {
    actions.push({ key: 'reject', label: 'Reject', icon: XCircle, tone: 'danger', onClick: () => onReject(doc) });
  }
  if (canArchiveDocument(session, doc) && onArchive) {
    actions.push({ key: 'archive', label: 'Archive', icon: Archive, onClick: () => onArchive(doc) });
  }
  if (downloadDecision.allowed && onDownload) {
    actions.push({ key: 'download', label: 'Download', icon: Download, onClick: () => onDownload(doc) });
  }
  if (canDeleteDocument(session, doc) && onDelete) {
    actions.push({ key: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => onDelete(doc) });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 cursor-default backdrop-blur-sm animate-fade"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col outline-none"
        style={{ background: 'var(--bg-card)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <h2 id={titleId} className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
            Document details
          </h2>
          <p id={descriptionId} className="sr-only">
            Preview metadata and quick actions for {doc.title}.
          </p>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-muted)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Title + badges */}
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              <ClassificationBadge classification={doc.classification} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                v{doc.currentVersion ?? 1}
              </span>
            </div>
            <h3 className="flex items-start gap-1.5 text-base font-semibold leading-snug" style={{ color: 'var(--text-strong)' }}>
              {doc.legalHold ? (
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Legal hold active" />
              ) : null}
              <span className="min-w-0">{doc.title}</span>
            </h3>
            {doc.description ? (
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {doc.description.length > 240 ? `${doc.description.slice(0, 240)}…` : doc.description}
              </p>
            ) : null}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-px border-b" style={{ background: 'var(--border-soft)', borderColor: 'var(--border-soft)' }}>
            <MetaCell icon={User} label="Owner" value={ownerDisplay} />
            <MetaCell icon={FileText} label="Type" value={doc.mimeType ?? (doc.filename ? 'File' : 'No file')} />
            <MetaCell icon={Clock} label="Updated" value={formatDateTime(doc.updatedAt)} />
            <MetaCell icon={Clock} label="Created" value={formatDateTime(doc.createdAt)} />
          </div>

          {/* Security posture */}
          {(doc.dlpStatus === 'DETECTED' || doc.legalHold || doc.retentionUntil) ? (
            <div className="px-5 py-4 border-b space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                Compliance
              </p>
              {doc.dlpStatus === 'DETECTED' ? (
                <PostureRow
                  icon={ShieldAlert}
                  tone="danger"
                  label="DLP findings detected"
                  detail={doc.dlpDetectedAt ? `Scanned ${formatDateTime(doc.dlpDetectedAt)}` : undefined}
                />
              ) : null}
              {doc.legalHold ? (
                <PostureRow
                  icon={Lock}
                  tone="warning"
                  label="Legal hold active"
                  detail={doc.legalHoldReason ?? undefined}
                />
              ) : null}
              {doc.retentionUntil ? (
                <PostureRow
                  icon={Shield}
                  tone="muted"
                  label={`Retention until ${formatDateTime(doc.retentionUntil)}`}
                  detail={doc.retentionClass ?? undefined}
                />
              ) : null}
            </div>
          ) : null}

          {/* Tags */}
          {doc.tags.length > 0 ? (
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="mb-2 flex items-center gap-1.5">
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
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Action bar */}
        <div
          className="flex flex-col gap-2 px-5 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex gap-2">
            <Link
              href={ROUTES.DOCUMENT_DETAIL(doc.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--color-primary)' }}
            >
              <Eye className="h-4 w-4" />
              Open
            </Link>
            {canEditDocument(session, doc) ? (
              <Link
                href={ROUTES.DOCUMENT_EDIT(doc.id)}
                className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-muted)]"
                style={{ borderColor: 'var(--input-border)', color: 'var(--text-main)' }}
              >
                <Pencil className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                Edit
              </Link>
            ) : null}
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <PreviewActionButton key={action.key} action={action} onAfter={onClose} />
              ))}
            </div>
          ) : null}

          {!downloadDecision.allowed && downloadDecision.reason ? (
            <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>
              Download unavailable: {downloadDecision.reason}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

interface PreviewAction {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'success' | 'danger';
  onClick: () => void;
}

function PreviewActionButton({ action, onAfter }: { action: PreviewAction; onAfter: () => void }) {
  const Icon = action.icon;
  const toneStyle =
    action.tone === 'danger'
      ? { borderColor: 'var(--state-error-border)', background: 'var(--state-error-bg)', color: 'var(--state-error-text)' }
      : action.tone === 'success'
        ? { borderColor: 'var(--status-published-border)', background: 'var(--status-published-bg)', color: 'var(--status-published-text)' }
        : { borderColor: 'var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-main)' };

  return (
    <button
      type="button"
      onClick={() => {
        action.onClick();
        onAfter();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95"
      style={toneStyle}
    >
      <Icon className="h-3.5 w-3.5" />
      {action.label}
    </button>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="px-5 py-3" style={{ background: 'var(--bg-card)' }}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <p className="break-words text-sm font-medium" style={{ color: 'var(--text-main)' }}>
        {value}
      </p>
    </div>
  );
}

function PostureRow({
  icon: Icon,
  tone,
  label,
  detail,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  tone: 'danger' | 'warning' | 'muted';
  label: string;
  detail?: string;
}) {
  const color =
    tone === 'danger'
      ? 'var(--state-error-text)'
      : tone === 'warning'
        ? 'var(--status-pending-text)'
        : 'var(--text-muted)';

  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
          {label}
        </p>
        {detail ? (
          <p className="text-xs leading-snug" style={{ color: 'var(--text-faint)' }}>
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
