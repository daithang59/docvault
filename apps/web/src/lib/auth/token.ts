import type { Session, UserInfo } from '@/features/auth/auth.types';
import type { UserRole } from '@/types/enums';

export interface JwtPayload {
  sub?: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
  [key: string]: unknown;
}

export interface CurrentUserDto {
  sub: string;
  username?: string;
  email?: string;
  roles: UserRole[];
  raw?: JwtPayload;
}

const KNOWN_ROLES: UserRole[] = [
  'viewer',
  'editor',
  'approver',
  'compliance_officer',
  'admin',
];

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  return Buffer.from(padded, 'base64').toString('utf8');
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export function normalizeUserRoles(roles: string[]): UserRole[] {
  const normalized = roles.flatMap((role) => (role === 'co' ? ['compliance_officer'] : [role]));
  return Array.from(new Set(normalized.filter((role): role is UserRole => KNOWN_ROLES.includes(role as UserRole))));
}

export function extractRoles(payload: JwtPayload): UserRole[] {
  const realmRoles = payload.realm_access?.roles ?? [];
  const topLevelRoles = Array.isArray(payload.roles) ? payload.roles : [];
  const resourceRoles = Object.values(payload.resource_access ?? {}).flatMap((entry) => entry.roles ?? []);

  return normalizeUserRoles([...realmRoles, ...topLevelRoles, ...resourceRoles]);
}

export function extractUsername(payload: JwtPayload): string {
  return (
    payload.preferred_username ||
    payload.username ||
    payload.name ||
    payload.email ||
    payload.sub ||
    'user'
  );
}

export function extractUserId(payload: JwtPayload): string {
  return payload.sub || 'unknown';
}

export function buildUserInfoFromTokenPayload(payload: JwtPayload): UserInfo {
  const username = extractUsername(payload);

  return {
    sub: extractUserId(payload),
    username,
    preferred_username: payload.preferred_username ?? username,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    lastName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
    roles: extractRoles(payload),
  };
}

export function buildSessionFromAccessToken(token: string): Session | null {
  const payload = parseJwt(token);
  if (!payload) return null;

  return {
    accessToken: token,
    user: buildUserInfoFromTokenPayload(payload),
  };
}

export function buildUserInfoFromCurrentUserDto(currentUser: CurrentUserDto): UserInfo {
  const username = currentUser.username || currentUser.sub;

  return {
    sub: currentUser.sub,
    username,
    preferred_username: username,
    email: currentUser.email,
    roles: normalizeUserRoles(currentUser.roles),
  };
}
