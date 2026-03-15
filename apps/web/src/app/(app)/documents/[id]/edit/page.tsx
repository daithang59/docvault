'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentDetail } from '@/lib/hooks/use-document-detail';
import { useUpdateDocument } from '@/lib/hooks/use-documents';
import { DocumentForm, DocumentFormValues } from '@/components/documents/document-form';
import { PageHeader } from '@/components/common/page-header';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { useAuth } from '@/lib/auth/auth-context';
import { canEditDocument } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { toast } from 'sonner';
import { TOAST_MESSAGES } from '@/lib/constants/labels';
import { ApiError } from '@/types/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditDocumentPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();

  const { data: doc, isLoading, isError, refetch } = useDocumentDetail(id);
  const update = useUpdateDocument(id);

  if (isLoading) return <LoadingState label="Loading document..." />;
  if (isError || !doc) return <ErrorState message="Failed to load document." onRetry={refetch} />;

  const canEdit = canEditDocument(session, doc);
  if (!canEdit) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#64748B]">You do not have permission to edit this document.</p>
        <Link href={ROUTES.DOCUMENT_DETAIL(id)} className="text-[#2563EB] text-sm mt-2 inline-block hover:underline">
          Back to document
        </Link>
      </div>
    );
  }

  async function handleSubmit(values: DocumentFormValues) {
    try {
      await update.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        classification: values.classification,
        tags: values.tags,
      });
      toast.success(TOAST_MESSAGES.DOCUMENT_UPDATED);
      router.push(ROUTES.DOCUMENT_DETAIL(id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update document.');
    }
  }

  return (
    <div>
      <Link
        href={ROUTES.DOCUMENT_DETAIL(id)}
        className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1E293B] transition mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to document
      </Link>

      <PageHeader
        title="Edit Document"
        subtitle="Update the metadata for this document."
      />

      <div className="max-w-2xl">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
          <DocumentForm
            defaultValues={{
              title: doc.title,
              description: doc.description ?? '',
              classification: doc.classification,
              tags: doc.tags,
            }}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            isLoading={update.isPending}
          >
            <Link
              href={ROUTES.DOCUMENT_DETAIL(id)}
              className="px-5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </Link>
          </DocumentForm>
        </div>
      </div>
    </div>
  );
}
