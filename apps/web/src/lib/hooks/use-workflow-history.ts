import { useQuery } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getWorkflowHistory } from '@/lib/api/metadata';

export function useWorkflowHistory(docId: string) {
  return useQuery({
    queryKey: documentsKeys.workflowHistory(docId),
    queryFn: () => getWorkflowHistory(docId),
    enabled: !!docId,
  });
}
