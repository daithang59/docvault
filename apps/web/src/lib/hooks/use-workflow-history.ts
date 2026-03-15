import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { getWorkflowHistory } from '@/lib/api/metadata';

export function useWorkflowHistory(docId: string) {
  return useQuery({
    queryKey: queryKeys.workflowHistory(docId),
    queryFn: () => getWorkflowHistory(docId),
    enabled: !!docId,
  });
}
