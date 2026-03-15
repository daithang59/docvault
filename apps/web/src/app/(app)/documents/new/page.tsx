'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentForm, DocumentFormValues } from '@/components/documents/document-form';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { PageHeader } from '@/components/common/page-header';
import { ProtectedAction } from '@/components/common/protected-action';
import { useCreateDocument, useUploadDocument } from '@/lib/hooks/use-documents';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';

export default function NewDocumentPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);

  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument(createdDocId ?? '');

  async function handleSubmit(values: DocumentFormValues) {
    try {
      const doc = await createDoc.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        classification: values.classification,
        tags: values.tags,
      });
      toast.success(TOAST_MESSAGES.DOCUMENT_CREATED);

      if (file) {
        setCreatedDocId(doc.id);
        try {
          await uploadDoc.mutateAsync(file);
          toast.success(TOAST_MESSAGES.VERSION_UPLOADED);
        } catch (uploadErr) {
          toast.error(
            `Document created, but file upload failed: ${
              uploadErr instanceof ApiError ? uploadErr.message : 'Upload error'
            }`
          );
        }
      }

      router.push(ROUTES.DOCUMENT_DETAIL(doc.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create document.');
    }
  }

  const isLoading = createDoc.isPending || uploadDoc.isPending;

  return (
    <ProtectedAction
      roles={['editor', 'admin']}
      fallback={<div className="text-center py-16 text-[#64748B]">You do not have permission to create documents.</div>}
    >
      <PageHeader
        title="New Document"
        subtitle="Create a new document entry and optionally upload the initial file."
      />
      <div className="max-w-2xl">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-6">
          <DocumentForm
            submitLabel="Save Draft"
            onSubmit={handleSubmit}
            isLoading={isLoading}
          >
            <button
              type="button"
              onClick={() => {}}
              className="px-5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
              disabled={isLoading}
            >
              Cancel
            </button>
          </DocumentForm>

          {/* File upload section */}
          <div className="border-t border-[#F1F5F9] pt-5">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Initial File (optional)</h3>
            <p className="text-xs text-[#94A3B8] mb-4">
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
