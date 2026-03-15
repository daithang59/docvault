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
  canUploadVersion,
  canManageAcl,
} from '@/lib/auth/guards';
import {
  useSubmitDocument,
  useApproveDocument,
  useRejectDocument,
  useArchiveDocument,
  useUploadDocument,
} from '@/lib/hooks/use-documents';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { UploadDropzone } from './upload-dropzone';
import {
  Pencil, Send, CheckCircle, XCircle, Archive, Download, Upload
} from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';

interface DocumentActionPanelProps {
  doc: DocumentDetail;
  onActionComplete?: () => void;
}

export function DocumentActionPanel({ doc, onActionComplete }: DocumentActionPanelProps) {
  const { session } = useAuth();

  const [confirmType, setConfirmType] = useState<'submit' | 'approve' | 'reject' | 'archive' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const submit = useSubmitDocument(doc.id);
  const approve = useApproveDocument(doc.id);
  const reject = useRejectDocument(doc.id);
  const archive = useArchiveDocument(doc.id);
  const upload = useUploadDocument(doc.id);
  const { download, isDownloading } = useDownloadDocument({
    onError: (msg) => toast.error(msg),
  });

  async function handleSubmit() {
    try {
      await submit.mutateAsync();
      toast.success(TOAST_MESSAGES.SUBMITTED);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to submit document.');
    }
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync();
      toast.success(TOAST_MESSAGES.APPROVED);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to approve document.');
    }
  }

  async function handleReject() {
    try {
      await reject.mutateAsync(rejectReason || undefined);
      toast.success(TOAST_MESSAGES.REJECTED);
      setRejectReason('');
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to reject document.');
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync();
      toast.success(TOAST_MESSAGES.ARCHIVED);
      onActionComplete?.();
    } catch (e) {
      const msg = e instanceof ApiError
        ? (e.statusCode === 404 ? TOAST_MESSAGES.ARCHIVE_UNAVAILABLE : e.message)
        : TOAST_MESSAGES.ARCHIVE_UNAVAILABLE;
      toast.error(msg);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    try {
      await upload.mutateAsync(uploadFile);
      toast.success(TOAST_MESSAGES.VERSION_UPLOADED);
      setShowUpload(false);
      setUploadFile(null);
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Upload failed.');
    }
  }

  const hasAnyAction =
    canEditDocument(session, doc) ||
    canSubmitDocument(session, doc) ||
    canApproveDocument(session, doc) ||
    canRejectDocument(session, doc) ||
    canArchiveDocument(session, doc) ||
    canDownloadDocument(session, doc);

  if (!hasAnyAction) return null;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <h3 className="text-sm font-semibold text-[#0F172A]">Actions</h3>
      </div>
      <div className="p-5 space-y-2.5">

        {/* Edit */}
        {canEditDocument(session, doc) && (
          <Link
            href={ROUTES.DOCUMENT_EDIT(doc.id)}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
          >
            <Pencil className="h-4 w-4 text-[#94A3B8]" />
            Edit Metadata
          </Link>
        )}

        {/* Upload new version */}
        {canUploadVersion(session, doc) && (
          <>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
            >
              <Upload className="h-4 w-4 text-[#94A3B8]" />
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
                    className="w-full px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition disabled:opacity-50"
                  >
                    {upload.isPending ? 'Uploading...' : 'Upload Version'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Submit */}
        {canSubmitDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('submit')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition"
          >
            <Send className="h-4 w-4" />
            Submit for Approval
          </button>
        )}

        {/* Approve */}
        {canApproveDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('approve')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-white border border-[#86EFAC] text-[#166534] text-sm font-medium hover:bg-[#DCFCE7] transition"
          >
            <CheckCircle className="h-4 w-4" />
            Approve Document
          </button>
        )}

        {/* Reject */}
        {canRejectDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('reject')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-white border border-[#FCA5A5] text-[#B91C1C] text-sm font-medium hover:bg-[#FEF2F2] transition"
          >
            <XCircle className="h-4 w-4" />
            Reject Document
          </button>
        )}

        {/* Archive */}
        {canArchiveDocument(session, doc) && (
          <button
            onClick={() => setConfirmType('archive')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] transition"
          >
            <Archive className="h-4 w-4" />
            Archive Document
          </button>
        )}

        {/* Download */}
        {canDownloadDocument(session, doc) && (
          <button
            onClick={() => download(doc.id)}
            disabled={isDownloading}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#1E293B] text-sm font-medium hover:bg-[#F8FAFC] transition disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-[#94A3B8]" />
            {isDownloading ? 'Preparing download...' : 'Download'}
          </button>
        )}

        {/* Manage ACL */}
        {canManageAcl(session) && doc.status === 'DRAFT' && (
          <p className="text-xs text-[#94A3B8] text-center pt-1">ACL management available in the Access Control panel below.</p>
        )}
      </div>

      {/* Confirm dialogs */}
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
          className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl resize-none outline-none focus:border-[#2563EB] transition"
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
    </div>
  );
}
