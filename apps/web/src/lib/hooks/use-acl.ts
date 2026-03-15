import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { getAcl, addAclEntry } from '@/lib/api/metadata';
import { AddAclEntryDto } from '@/types/document';

export function useAcl(docId: string) {
  return useQuery({
    queryKey: queryKeys.acl(docId),
    queryFn: () => getAcl(docId),
    enabled: !!docId,
  });
}

export function useAddAclEntry(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddAclEntryDto) => addAclEntry(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.acl(docId) });
    },
  });
}
