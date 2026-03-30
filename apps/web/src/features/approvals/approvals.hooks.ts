'use client';

import { useQuery } from '@tanstack/react-query';
import { approvalsKeys } from './approvals.keys';
import { getApprovalQueue } from './approvals.api';
import type { ApprovalQueueFilters } from './approvals.types';
import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';

export function useApprovalQueue(filters?: ApprovalQueueFilters) {
  return useQuery({
    queryKey: approvalsKeys.queue(filters),
    queryFn: () => getApprovalQueue(filters),
  });
}

export interface UserDisplayInfo {
  displayName: string;
  username: string;
}

/** Fetch display names for a list of user IDs (owner IDs) */
async function fetchUserDisplayNames(ids: string[]): Promise<Record<string, UserDisplayInfo>> {
  if (!ids.length) return {};
  const res = await apiClient.post<Record<string, UserDisplayInfo>>(
    apiEndpoints.users.batch,
    { ids },
  );
  return res.data;
}

/**
 * Returns a map of { [ownerId]: displayName } for the given owner IDs.
 * Results are cached so concurrent callers share one network request.
 * UUIDs that can't be resolved will have displayName replaced with "Unknown User".
 */
export function useOwnerDisplayNames(ownerIds: string[]) {
  return useQuery({
    // Deduplicate + stable key
    queryKey: ['user-displays', [...new Set(ownerIds)].sort()],
    queryFn: async () => {
      const results = await fetchUserDisplayNames([...new Set(ownerIds)]);
      // Post-process: UUIDs that couldn't be resolved by the backend → "Unknown User"
      for (const id of Object.keys(results)) {
        if (id.includes('-') && !results[id]?.displayName) {
          results[id] = { displayName: 'Unknown User', username: id };
        }
      }
      return results;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — display names don't change often
  });
}

/**
 * Fetch a single user's display name from Keycloak by ownerId (username).
 * Falls back to formatted ownerId if the API call fails or returns empty.
 */
async function fetchOwnerDisplayName(ownerId: string): Promise<string> {
  if (!ownerId) return 'Unknown';
  try {
    const res = await apiClient.post<Record<string, UserDisplayInfo>>(
      apiEndpoints.users.batch,
      { ids: [ownerId] },
    );
    const info = res.data[ownerId];
    if (info?.displayName) return info.displayName;
  } catch {
    // Fall through to fallback
  }
  // UUIDs (contain hyphens) can't be formatted — return a generic label
  if (ownerId.includes('-')) return 'Unknown User';
  // Format as "Editor 1"
  return ownerId
    .replace(/(\d+)$/, ' $1')
    .replace(/^[a-z]+/, (m) => m.charAt(0).toUpperCase() + m.slice(1));
}

export function useOwnerDisplayName(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['user-display', ownerId],
    queryFn: () => fetchOwnerDisplayName(ownerId ?? ''),
    enabled: !!ownerId,
    staleTime: 10 * 60 * 1000,
  });
}
