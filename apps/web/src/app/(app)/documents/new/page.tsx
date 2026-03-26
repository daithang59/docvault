'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentForm, DocumentFormValues } from '@/components/documents/document-form';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { PageHeader } from '@/components/common/page-header';
import { ProtectedAction } from '@/components/common/protected-action';
import { useCreateDocument } from '@/lib/hooks/use-documents';
import { uploadDocument } from '@/lib/api/documents';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { getErrorMessage } from '@/lib/api/errors';

export default function NewDocumentPage() {
  const router = useRouter();
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
        try {
          setIsUploading(true);
          await uploadDocument(doc.id, file);
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
      fallback={<div className="py-16 text-center text-[var(--text-muted)]">You do not have permission to create documents.</div>}
    >
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="New Document"
          subtitle="Create a new document entry and optionally upload the initial file."
        />
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
