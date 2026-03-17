import type { UserRole } from '@/types/enums';
import type { Session } from '@/types/auth';

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
  const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
  const realmRoles: UserRole[] = (realmAccess?.roles ?? []).filter((r): r is UserRole =>
    (ALL_ROLES as string[]).includes(r),
  );
  // Also check resource_access or top-level roles claim
  const topRoles = Array.isArray(payload['roles'])
    ? (payload['roles'] as string[]).filter((r): r is UserRole =>
        (ALL_ROLES as string[]).includes(r),
      )
    : [];
  return Array.from(new Set([...realmRoles, ...topRoles]));
}
