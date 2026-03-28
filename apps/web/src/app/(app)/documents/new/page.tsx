'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentForm, DocumentFormValues } from '@/components/documents/document-form';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { PageHeader } from '@/components/common/page-header';
import { ProtectedAction } from '@/components/common/protected-action';
import { EmptyState } from '@/components/common/empty-state';
import { useCreateDocument } from '@/lib/hooks/use-documents';
import { uploadDocumentFile } from '@/features/documents/documents.api';
import { documentsKeys } from '@/features/documents/documents.keys';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { getErrorMessage } from '@/lib/api/errors';

export default function NewDocumentPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createDoc = useCreateDocument();

  async function handleSubmit(values: DocumentFormValues) {
    try {
      const doc = await createDoc.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        classification: values.classification as import('@/types/enums').ClassificationLevel,
        tags: values.tags,
      });
      toast.success(TOAST_MESSAGES.DOCUMENT_CREATED);

      if (file) {
        setIsUploading(true);
        try {
          await uploadDocumentFile(doc.id, file);
          // Invalidate the detail query so the next page fetches fresh data
          // that includes the newly created DocumentVersion row from PostgreSQL.
          await qc.invalidateQueries({ queryKey: documentsKeys.detail(doc.id) });
          await qc.invalidateQueries({ queryKey: documentsKeys.lists() });
          toast.success(TOAST_MESSAGES.VERSION_UPLOADED);
        } catch (uploadErr) {
          toast.error(
            `Document created, but file upload failed: ${
              getErrorMessage(uploadErr) || 'Upload error'
            }`
          );
        } finally {
          setIsUploading(false);
        }
      }

      router.push(ROUTES.DOCUMENT_DETAIL(doc.id));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  const isLoading = createDoc.isPending || isUploading;

  return (
    <ProtectedAction
      roles={['editor', 'admin']}
      fallback={
        <EmptyState
          icon="lock"
          title="Không có quyền truy cập"
          description="Bạn cần vai trò Editor hoặc Admin để tạo tài liệu mới."
        />
      }
    >
      <div className="animate-in delay-1 mx-auto max-w-2xl">
        <PageHeader
          title="New Document"
          subtitle="Create a new document entry and optionally upload the initial file."
        />
      </div>
      <div className="animate-in delay-2 mx-auto max-w-2xl">
        <div
          className="space-y-6 rounded-2xl border p-4 sm:p-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <DocumentForm
            submitLabel="Save Draft"
            onSubmit={handleSubmit}
            isLoading={isLoading}
          >
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border bg-[var(--input-bg)] px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)]"
              style={{ borderColor: 'var(--border-strong)' }}
              disabled={isLoading}
            >
              Cancel
            </button>
          </DocumentForm>

          {/* File upload section */}
          <div className="border-t pt-5" style={{ borderColor: 'var(--border-soft)' }}>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text-strong)]">Initial File (optional)</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Attach a file to this document. You can also upload later from the document detail page.
            </p>
            <UploadDropzone
              onFileSelect={setFile}
              selectedFile={file}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </ProtectedAction>
  );
}
