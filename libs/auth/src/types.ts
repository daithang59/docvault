/**
 * Shared auth types — used by all services.
 * Mirrors the Keycloak JWT payload shape returned by JwtStrategy.validate().
 */

export type KeycloakAccessToken = {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  aud?: string | string[];
  azp?: string;
  iss?: string;
  exp?: number;
  iat?: number;
};

export type ServiceUser = {
  sub: string;
  username?: string;
  email?: string;
  roles: string[];
  raw?: KeycloakAccessToken;
};

export type RequestContext = {
  traceId: string;
  authorization?: string;
  actorId: string;
  roles: string[];
  ip?: string;
};

/** Build the actorId string from a ServiceUser — prefer username, fall back to sub */
export function buildActorId(user: ServiceUser | undefined): string {
  if (!user) return 'unknown';
  return user.username ?? user.sub ?? 'unknown';
}

/** Build a RequestContext from an Express Request */
export function buildRequestContext(req: any): RequestContext {
  const headerRoles =
    typeof req.headers['x-roles'] === 'string'
      ? req.headers['x-roles']
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean)
      : [];

  const user = req.user as ServiceUser | undefined;

  return {
    traceId: req.traceId ?? req.headers['x-request-id'],
    authorization: req.headers.authorization,
    actorId: user ? buildActorId(user) : (req.headers['x-user-id'] ?? 'unknown'),
    roles: user?.roles ?? headerRoles,
    ip: req.ip,
  };
}

/** Canonical role constants shared across the entire monorepo */
export const ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  APPROVER: 'approver',
  COMPLIANCE_OFFICER: 'compliance_officer',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that have implicit read access to published documents */
export const READER_ROLES: Role[] = [
  ROLES.VIEWER,
  ROLES.EDITOR,
  ROLES.APPROVER,
  ROLES.ADMIN,
];
