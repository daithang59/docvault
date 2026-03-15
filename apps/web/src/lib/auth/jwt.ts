interface JwtPayload {
  sub?: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  roles?: string[];
  [key: string]: unknown;
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractRoles(payload: JwtPayload): string[] {
  // Try realm_access (Keycloak style)
  if (payload.realm_access?.roles) {
    return payload.realm_access.roles;
  }
  // Try direct roles array
  if (Array.isArray(payload.roles)) {
    return payload.roles;
  }
  // Try resource_access
  if (payload.resource_access) {
    const allRoles: string[] = [];
    Object.values(payload.resource_access).forEach((r) => {
      if (r.roles) allRoles.push(...r.roles);
    });
    if (allRoles.length > 0) return allRoles;
  }
  return [];
}

export function extractUsername(payload: JwtPayload): string {
  return (
    payload.preferred_username ||
    payload.username ||
    payload.name ||
    payload.sub ||
    'user'
  );
}

export function extractUserId(payload: JwtPayload): string {
  return payload.sub || 'unknown';
}
