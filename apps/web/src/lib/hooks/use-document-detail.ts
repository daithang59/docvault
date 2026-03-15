import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { getDocumentDetail } from '@/lib/api/metadata';

export function useDocumentDetail(docId: string) {
  return useQuery({
    queryKey: queryKeys.documentDetail(docId),
    queryFn: () => getDocumentDetail(docId),
    enabled: !!docId,
  });
}
