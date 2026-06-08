'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import {
  fetchMyOrg,
  fetchOrgMembers,
  updateMemberRole,
  removeMember,
} from './org.api';

/**
 * Loads the current user's organization once a session is present.
 * The first call auto-provisions an organization server-side.
 */
export function useMyOrg() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['org', 'me'] as const,
    queryFn: fetchMyOrg,
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  return { org: query.data ?? null, loading: query.isLoading };
}

/** Loads the member list of the current user's organization (admin only). */
export function useOrgMembers(enabled = true) {
  return useQuery({
    queryKey: ['org', 'members'] as const,
    queryFn: fetchOrgMembers,
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Change a member's role; invalidates the member list on success. */
export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'MEMBER' | 'ADMIN' }) =>
      updateMemberRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', 'members'] });
    },
  });
}

/** Remove a member; invalidates the member list on success. */
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', 'members'] });
    },
  });
}
