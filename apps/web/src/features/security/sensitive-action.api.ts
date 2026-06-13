import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import type {
  SensitiveActionProofRequest,
  SensitiveActionProofResponse,
} from './sensitive-action';

export async function requestSensitiveActionProof(
  request: SensitiveActionProofRequest,
): Promise<SensitiveActionProofResponse> {
  const res = await apiClient.post<SensitiveActionProofResponse>(
    apiEndpoints.metadata.sensitiveActions.proof,
    request,
  );
  return unwrap(res);
}
