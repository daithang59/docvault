'use client';

import { useState } from 'react';
import { DocumentDetail } from '@/types/document';
import { useAuth } from '@/lib/auth/auth-context';
import {
  canEditDocument,
  canSubmitDocument,
  canApproveDocument,
  canRejectDocument,
  canArchiveDocument,
  canDownloadDocument,
  canPreviewDocument,
  canUploadVersion,
  canManageAcl,
  canDeleteDocument,
} from '@/lib/auth/guards';
import {
  useSubmitDocument,
  useApproveDocument,
  useRejectDocument,
  useArchiveDocument,
  useUploadDocument,
  useDeleteDocument,
} from '@/lib/hooks/use-documents';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { UploadDropzone } from './upload-dropzone';
import {
  Pencil, Send, CheckCircle, XCircle, Archive, Download, Upload, Eye, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { getErrorMessage, parseApiError } from '@/lib/api/errors';

interface DocumentActionPanelProps {
  doc: DocumentDetail;
  onActionComplete?: () => void;
  onPreview?: () => void;
}

export function DocumentActionPanel({ doc, onActionComplete, onPreview }: DocumentActionPanelProps) {
  const { session } = useAuth();

  const [confirmType, setConfirmType] = useState<'submit' | 'approve' | 'reject' | 'archive' | 'delete' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const submit = useSubmitDocument(doc.id);
  const approve = useApproveDocument(doc.id);
  const reject = useRejectDocument(doc.id);
  const archive = useArchiveDocument(doc.id);
  const upload = useUploadDocument(doc.id);
  const deleteDoc = useDeleteDocument(doc.id);
  const { download, isDownloading } = useDownloadDocument({
    onError: (msg) => toast.error(msg),
  });

  async function handleSubmit() {
    try {
      await submit.mutateAsync();
      toast.success(TOAST_MESSAGES.SUBMITTED);
      onActionComplete?.();
    } catch (e) {
      const err = parseApiError(e);
      const msg = err.statusCode === 409
        ? TOAST_MESSAGES.CONFLICT_SUBMIT
        : err.statusCode === 403
          ? TOAST_MESSAGES.FORBIDDEN_ACTION
          : getErrorMessage(e);
      toast.error(msg);
    }
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync();
      toast.success(TOAST_MESSAGES.APPROVED);
      onActionComplete?.();
    } catch (e) {
      const err = parseApiError(e);
      const msg = err.statusCode === 409
        ? TOAST_MESSAGES.CONFLICT_APPROVE
        : err.statusCode === 403
          ? TOAST_MESSAGES.FORBIDDEN_ACTION
          : getErrorMessage(e);
      toast.error(msg);
    }
  }

  async function handleReject() {
    try {
      await reject.mutateAsync(rejectReason || undefined);
      toast.success(TOAST_MESSAGES.REJECTED);
      setRejectReason('');
      onActionComplete?.();
    } catch (e) {
      const err = parseApiError(e);
      const msg = err.statusCode === 409
        ? TOAST_MESSAGES.CONFLICT_REJECT
        : err.statusCode === 403
          ? TOAST_MESSAGES.FORBIDDEN_ACTION
          : getErrorMessage(e);
      toast.error(msg);
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync();
      toast.success(TOAST_MESSAGES.ARCHIVED);
      onActionComplete?.();
    } catch (e) {
      const err = parseApiError(e);
      const msg = err.statusCode === 409
        ? TOAST_MESSAGES.CONFLICT_ARCHIVE
        : err.statusCode === 403
          ? TOAST_MESSAGES.FORBIDDEN_ACTION
          : err.statusCode === 404
            ? TOAST_MESSAGES.ARCHIVE_UNAVAILABLE
            : getErrorMessage(e);
      toast.error(msg);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    try {
      const result = await upload.mutateAsync(uploadFile);
      // Defensive: ensure the response actually contains a version record.
      // If the backend silently fails (e.g. HTTP 500 with empty body),
      // mutateAsync resolves with undefined and we must not show success.
      if (!result) {
        throw new Error('Server returned an empty response.');
      }
      toast.success(TOAST_MESSAGES.VERSION_UPLOADED);
      setShowUpload(false);
      setUploadFile(null);
      onActionComplete?.();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  const hasAnyAction =
    canEditDocument(session, doc) ||
    canSubmitDocument(session, doc) ||
    canApproveDocument(session, doc) ||
    canRejectDocument(session, doc) ||
    canArchiveDocument(session, doc) ||
    canDownloadDocument(session, doc) ||
    canPreviewDocument(session, doc) ||
    canDeleteDocument(session, doc);

  if (!hasAnyAction) return null;

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
        <h3 className="text-sm font-semibold text-[var(--text-strong)]">Actions</h3>
      </div>
      <div className="space-y-2.5 p-5">

        {canEditDocument(session, doc) && (
          <Link
            href={ROUTES.DOCUMENT_EDIT(doc.id)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--input-border)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            <Pencil className="h-4 w-4 text-[var(--text-muted)]" />
            Edit Metadata
          </Link>
        )}

        {canUploadVersion(session, doc) && (
          <>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--input-border)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              <Upload className="h-4 w-4 text-[var(--text-muted)]" />
              Upload New Version
            </button>
            {showUpload && (
              <div className="space-y-3">
                <UploadDropzone
                  onFileSelect={setUploadFile}
                  selectedFile={uploadFile}
                />
                {uploadFile && (
                  <button
                    onClick={handleUpload}
                    disabled={upload.isPending}
                    className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
                  >
                    {upload.isPending ? 'Uploading...' : 'Upload Version'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {canSubmitDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('submit')}
            className="btn-primary flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition"
          >
            <Send className="h-4 w-4" />
            Submit for Approval
          </button>
        )}

        {canApproveDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('approve')}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--status-published-border)] bg-[var(--status-published-bg)] px-4 py-2.5 text-sm font-medium text-[var(--status-published-text)] transition hover:brightness-95"
          >
            <CheckCircle className="h-4 w-4" />
            Approve Document
          </button>
        )}

        {canRejectDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('reject')}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-4 py-2.5 text-sm font-medium text-[var(--state-error-text)] transition hover:brightness-95"
          >
            <XCircle className="h-4 w-4" />
            Reject Document
          </button>
        )}

        {canArchiveDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('archive')}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)]"
          >
            <Archive className="h-4 w-4" />
            Archive Document
          </button>
        )}

        {canDeleteDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('delete')}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-4 py-2.5 text-sm font-medium text-[var(--state-error-text)] transition hover:brightness-95"
          >
            <Trash2 className="h-4 w-4" />
            Delete Document
          </button>
        )}

        {canPreviewDocument(session, doc) && onPreview && (
          <button
            onClick={onPreview}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--input-border)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            <Eye className="h-4 w-4 text-[var(--text-muted)]" />
            Preview
          </button>
        )}

        {canDownloadDocument(session, doc) && (
          <button
            onClick={() => download(doc.id)}
            disabled={isDownloading}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-[var(--text-muted)]" />
            {isDownloading ? 'Preparing download...' : 'Download'}
          </button>
        )}

        {canManageAcl(session, doc) && doc.status === 'DRAFT' && (
          <p className="pt-1 text-center text-xs text-[var(--text-muted)]">ACL management available in the Access Control panel below.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmType === 'submit'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Submit Document"
        description="Document will be sent to approvers and cannot be edited until reviewed."
        confirmLabel="Submit"
        onConfirm={handleSubmit}
      />
      <ConfirmDialog
        open={confirmType === 'approve'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Approve Document"
        description="Document will be published and available to viewers."
        confirmLabel="Approve"
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={confirmType === 'reject'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Reject Document"
        description="Document will be returned to Draft status."
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (optional)..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:border-[var(--border-focus)]"
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmType === 'archive'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Archive Document"
        description="Document will be archived and read-only."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleArchive}
      />
      <ConfirmDialog
        open={confirmType === 'delete'}
        onOpenChange={(o) => !o && setConfirmType(null)}
        title="Delete Document"
        description="This document will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          try {
            await deleteDoc.mutateAsync();
            toast.success('Document deleted.');
            onActionComplete?.();
          } catch (e) {
            const msg = getErrorMessage(e);
            toast.error(msg);
          }
        }}
      />
    </div>
  );
}
