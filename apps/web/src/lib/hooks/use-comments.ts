import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';

export interface DocumentComment {
  id: string;
  docId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export function useComments(docId: string) {
  return useQuery({
    queryKey: ['comments', docId],
    queryFn: async () => {
      const res = await apiClient.get<DocumentComment[]>(
        apiEndpoints.metadata.documents.comments(docId),
      );
      return unwrap(res);
    },
    enabled: !!docId,
  });
}

export function useAddComment(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiClient.post<DocumentComment>(
        apiEndpoints.metadata.documents.comments(docId),
        { content },
      );
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', docId] });
    },
  });
}
