import { useQuery } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getDocumentDetail } from '@/lib/api/metadata';

export function useDocumentDetail(docId: string) {
  return useQuery({
    queryKey: documentsKeys.detail(docId),
    queryFn: () => getDocumentDetail(docId),
    enabled: !!docId,
  });
}
