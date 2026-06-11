import { useQuery } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getDocumentDetail } from '@/lib/api/metadata';
import { getShareToken } from '@/features/share-links/share-token-store';

export function useDocumentDetail(docId: string) {
  const shareToken = getShareToken(docId);
  return useQuery({
    queryKey: [...documentsKeys.detail(docId), shareToken ? 'share' : 'acl'] as const,
    queryFn: () => getDocumentDetail(docId, shareToken),
    enabled: !!docId,
  });
}
