export type ServiceUser = {
  sub: string;
  username?: string;
  roles?: string[];
};

export type RequestContext = {
  traceId: string;
  authorization?: string;
  actorId: string;
  roles: string[];
  ip?: string;
};

export function buildActorId(user: ServiceUser): string {
  return user.sub ?? user.username ?? 'unknown';
}

export function buildRequestContext(req: any): RequestContext {
  const headerRoles =
    typeof req.headers['x-roles'] === 'string'
      ? req.headers['x-roles']
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

  return {
    traceId: req.traceId ?? req.headers['x-request-id'],
    authorization: req.headers.authorization,
    actorId: buildActorId(req.user),
    roles: req.user?.roles ?? headerRoles,
    ip: req.ip,
  };
}
