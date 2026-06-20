import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import type {
  CreateShareLinkInput,
  CreatedShareLink,
  ShareLink,
  ShareLinkRedeemResult,
} from './share-links.types';

export async function createShareLink(
  docId: string,
  input: CreateShareLinkInput,
): Promise<CreatedShareLink> {
  const res = await apiClient.post<CreatedShareLink>(
    apiEndpoints.metadata.documents.shareLinks(docId),
    input,
  );
  return unwrap(res);
}

export async function listShareLinks(docId: string): Promise<ShareLink[]> {
  const res = await apiClient.get<ShareLink[]>(
    apiEndpoints.metadata.documents.shareLinks(docId),
  );
  return unwrap(res);
}

export async function revokeShareLink(
  docId: string,
  linkId: string,
): Promise<ShareLink> {
  const res = await apiClient.delete<ShareLink>(
    apiEndpoints.metadata.documents.shareLink(docId, linkId),
  );
  return unwrap(res);
}

export async function redeemShareLink(
  token: string,
): Promise<ShareLinkRedeemResult> {
  const res = await apiClient.post<ShareLinkRedeemResult>(
    apiEndpoints.metadata.shareLinks.redeem,
    { token },
  );
  return unwrap(res);
}
