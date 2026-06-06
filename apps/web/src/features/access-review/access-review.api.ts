import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import type { DocumentDetail } from '@/features/documents/documents.types';

export async function getAccessReviewDocuments(): Promise<DocumentDetail[]> {
  const res = await apiClient.get<DocumentDetail[]>(
    apiEndpoints.metadata.accessReview.documents,
  );
  return unwrap(res);
}
