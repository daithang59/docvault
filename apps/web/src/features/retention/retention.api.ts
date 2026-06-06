import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import type {
  RetentionEvidenceResult,
  RetentionRunResult,
} from './retention.types';
import { SENSITIVE_ACTION_PROOF_HEADER } from '@/features/security/sensitive-action';

export interface RunRetentionInput {
  asOf?: string;
  stepUpProof?: string;
}

export async function getRetentionEvidence(
  asOf?: string,
): Promise<RetentionEvidenceResult> {
  const res = await apiClient.get<RetentionEvidenceResult>(
    apiEndpoints.metadata.retention.documents,
    {
      params: asOf ? { asOf } : undefined,
    },
  );
  return unwrap(res);
}

export async function runRetention(
  input: RunRetentionInput = {},
): Promise<RetentionRunResult> {
  const res = await apiClient.post<RetentionRunResult>(
    apiEndpoints.metadata.retention.run,
    undefined,
    {
      params: input.asOf ? { asOf: input.asOf } : undefined,
      headers: input.stepUpProof
        ? {
            [SENSITIVE_ACTION_PROOF_HEADER]: input.stepUpProof,
          }
        : undefined,
    },
  );
  return unwrap(res);
}
