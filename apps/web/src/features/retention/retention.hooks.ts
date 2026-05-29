'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRetentionEvidence, runRetention } from './retention.api';
import { retentionKeys } from './retention.keys';
import { documentsKeys } from '@/features/documents/documents.keys';
import { auditKeys } from '@/features/audit/audit.keys';

export function useRetentionEvidence(asOf?: string) {
  return useQuery({
    queryKey: [...retentionKeys.evidence(), asOf] as const,
    queryFn: () => getRetentionEvidence(asOf),
  });
}

export function useRunRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (asOf?: string) => runRetention(asOf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retentionKeys.all });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: auditKeys.all });
    },
  });
}
