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
import { getErrorMessage } from '@/lib/api/errors';
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
        <p className="text-[var(--text-muted)]">You do not have permission to edit this document.</p>
        <Link href={ROUTES.DOCUMENT_DETAIL(id)} className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline">
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
        classification: values.classification as import('@/types/enums').ClassificationLevel,
        tags: values.tags,
      });
      toast.success(TOAST_MESSAGES.DOCUMENT_UPDATED);
      router.push(ROUTES.DOCUMENT_DETAIL(id));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <Link
          href={ROUTES.DOCUMENT_DETAIL(id)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to document
        </Link>

        <PageHeader
          title="Edit Document"
          subtitle="Update the metadata for this document."
        />

        <div className="rounded-2xl border bg-[var(--bg-card)] p-4 sm:p-6" style={{ borderColor: 'var(--border-soft)' }}>
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
              className="rounded-xl border bg-[var(--input-bg)] px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)]"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              Cancel
            </Link>
          </DocumentForm>
        </div>
      </div>
    </div>
  );
}
