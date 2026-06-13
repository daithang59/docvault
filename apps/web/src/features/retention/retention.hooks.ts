'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRetentionEvidence, runRetention } from './retention.api';
import { retentionKeys } from './retention.keys';
import { documentsKeys } from '@/features/documents/documents.keys';
import { auditKeys } from '@/features/audit/audit.keys';
import { requestSensitiveActionProof } from '@/features/security/sensitive-action.api';

interface RunRetentionMutationInput {
  asOf?: string;
  challengePhrase: string;
}

export function useRetentionEvidence(asOf?: string) {
  return useQuery({
    queryKey: [...retentionKeys.evidence(), asOf] as const,
    queryFn: () => getRetentionEvidence(asOf),
  });
}

export function useRunRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RunRetentionMutationInput) => {
      const { proof } = await requestSensitiveActionProof({
        action: 'run-retention',
        challengePhrase: input.challengePhrase,
      });
      return runRetention({ asOf: input.asOf, stepUpProof: proof });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retentionKeys.all });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: auditKeys.all });
    },
  });
}
