import type { UserRole } from '@/types/enums';
import type { Session } from '@/types/auth';
import { extractRoles as extractRolesFromPayload } from './token';

export const ALL_ROLES: UserRole[] = [
  'viewer',
  'editor',
  'approver',
  'compliance_officer',
  'admin',
];

/** Check if a session has a specific role */
export function hasRole(session: Session | null, role: UserRole): boolean {
  if (!session) return false;
  return session.user.roles.includes(role);
}

/** Check if a session has any of the given roles */
export function hasAnyRole(session: Session | null, roles: UserRole[]): boolean {
  if (!session) return false;
  return roles.some((r) => session.user.roles.includes(r));
}

/** Extract roles from Keycloak JWT realm_access claim */
export function extractRolesFromJwt(payload: Record<string, unknown>): UserRole[] {
  return extractRolesFromPayload(payload);
}
