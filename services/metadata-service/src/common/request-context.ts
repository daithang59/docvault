export type ServiceUser = {
  sub: string;
  username?: string;
  roles?: string[];
  groups?: string[];
};

export type RequestContext = {
  traceId: string;
  authorization?: string;
  actorId: string;
  roles: string[];
  groups?: string[];
  ip?: string;
};

export function buildActorId(user: ServiceUser): string {
  return user.sub ?? user.username ?? 'unknown';
}

export function normalizeGroups(groups?: string[]): string[] {
  return Array.from(
    new Set(
      (groups ?? [])
        .map((group) => group.trim())
        .filter(Boolean)
        .map((group) => group.replace(/^\/+/, '')),
    ),
  );
}

export function buildRequestContext(req: any): RequestContext {
  const headerRoles =
    typeof req.headers['x-roles'] === 'string'
      ? req.headers['x-roles']
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];
  const headerGroups =
    typeof req.headers['x-groups'] === 'string'
      ? req.headers['x-groups']
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

  return {
    traceId: req.traceId ?? req.headers['x-request-id'],
    authorization: req.headers.authorization,
    actorId: buildActorId(req.user),
    roles: req.user?.roles ?? headerRoles,
    groups: normalizeGroups(req.user?.groups ?? headerGroups),
    ip: req.ip,
  };
}
