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

/** Input for adding a member: provide a username, email, or userId. */
export interface AddMemberInput {
  identifier: string;
  role?: 'MEMBER' | 'ADMIN';
}

/**
 * Add a member to the current organization (admin only).
 * `identifier` may be a Keycloak username, email, or user id (sub);
 * the gateway resolves it to the stable user id before persisting.
 */
export async function addMember(
  input: AddMemberInput,
): Promise<OrganizationMember> {
  const { data } = await apiClient.post<OrganizationMember>(
    apiEndpoints.orgs.members,
    { userId: input.identifier, role: input.role ?? 'MEMBER' },
  );
  return data;
}
/** Remove a member from the organization (admin only). */
export async function removeMember(userId: string): Promise<void> {
  await apiClient.delete(apiEndpoints.orgs.member(userId));
}

export interface OrganizationGroup {
  id: string;
  name: string;
  path: string;
}

/**
 * List Keycloak realm groups for ACL subject pickers.
 * Returns an empty array when admin credentials are not configured server-side.
 * Readable by editor, approver, compliance_officer, and admin.
 */
export async function fetchOrgGroups(): Promise<OrganizationGroup[]> {
  const { data } = await apiClient.get<OrganizationGroup[]>(
    apiEndpoints.orgs.groups,
  );
  return data;
}