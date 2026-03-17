import type { UserRole } from '@/types/enums';

/** Authenticated user info */
export interface UserInfo {
  sub: string;                   // User ID (Keycloak subject)
  username: string;
  preferred_username?: string;   // Keycloak preferred_username claim
  name?: string;                 // Display name
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: UserRole[];
}

/** Full auth session stored in localStorage and context */
export interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;   // Unix ms
  user: UserInfo;
}

/** Auth context value exposed via useAuth() */
export interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  login: (session: Session) => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}
