'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import {
  fetchMyOrg,
  fetchOrgMembers,
  updateMemberRole,
  removeMember,
  type OrganizationInfo,
} from './org.api';

/**
 * Loads the current user's organization once a session is present.
 * The first call auto-provisions an organization server-side.
 */
export function useMyOrg() {
  const { session } = useAuth();
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      setOrg(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyOrg()
      .then((data) => {
        if (!cancelled) setOrg(data);
      })
      .catch(() => {
        if (!cancelled) setOrg(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { org, loading };
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
