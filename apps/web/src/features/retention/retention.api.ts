import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import type {
  RetentionEvidenceResult,
  RetentionRunResult,
} from './retention.types';

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

export async function runRetention(asOf?: string): Promise<RetentionRunResult> {
  const res = await apiClient.post<RetentionRunResult>(
    apiEndpoints.metadata.retention.run,
    undefined,
    {
      params: asOf ? { asOf } : undefined,
    },
  );
  return unwrap(res);
}
