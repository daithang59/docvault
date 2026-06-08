import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  role: 'MEMBER' | 'ADMIN';
}

export interface OrganizationMember {
  userId: string;
  role: 'MEMBER' | 'ADMIN';
  joinedAt: string;
}

/** Fetch the current user's organization. Auto-provisions on first call. */
export async function fetchMyOrg(): Promise<OrganizationInfo> {
  const { data } = await apiClient.get<OrganizationInfo>(apiEndpoints.orgs.me);
  return data;
}

/** List members of the current user's organization (admin only). */
export async function fetchOrgMembers(): Promise<OrganizationMember[]> {
  const { data } = await apiClient.get<OrganizationMember[]>(
    apiEndpoints.orgs.members,
  );
  return data;
}

/** Update a member's role (admin only). */
export async function updateMemberRole(
  userId: string,
  role: 'MEMBER' | 'ADMIN',
): Promise<OrganizationMember> {
  const { data } = await apiClient.patch<OrganizationMember>(
    apiEndpoints.orgs.member(userId),
    { role },
  );
  return data;
}

/** Remove a member from the organization (admin only). */
export async function removeMember(userId: string): Promise<void> {
  await apiClient.delete(apiEndpoints.orgs.member(userId));
}
