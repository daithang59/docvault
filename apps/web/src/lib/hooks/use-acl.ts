import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getAcl, addAclEntry } from '@/lib/api/metadata';
import { AddAclEntryDto } from '@/types/document';

export function useAcl(docId: string) {
  return useQuery({
    queryKey: documentsKeys.acl(docId),
    queryFn: () => getAcl(docId),
    enabled: !!docId,
  });
}

export function useAddAclEntry(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddAclEntryDto) => addAclEntry(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.acl(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
    },
  });
}
