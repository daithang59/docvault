'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import {
  fetchMyOrg,
  fetchOrgMembers,
  updateMemberRole,
  removeMember,
  addMember,
  fetchOrgGroups,
} from './org.api';
import type { AddMemberInput } from './org.api';

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

/** Add a member; invalidates the member list on success. */
export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => addMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', 'members'] });
    },
  });
}

/**
 * Loads the org member list for ACL subject pickers.
 * Available to editor/approver/compliance_officer/admin server-side.
 */
export function useOrgMembersForPicker(enabled = true) {
  return useQuery({
    queryKey: ['org', 'members', 'picker'] as const,
    queryFn: fetchOrgMembers,
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Loads Keycloak realm groups for the GROUP ACL subject picker.
 * Returns [] when admin credentials are not configured server-side.
 */
export function useOrgGroups(enabled = true) {
  return useQuery({
    queryKey: ['org', 'groups'] as const,
    queryFn: fetchOrgGroups,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}