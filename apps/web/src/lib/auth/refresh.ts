import axios from 'axios';
import { env } from '@/config/env';
import { loadSession } from './session';
import type { Session } from '@/types/auth';
import type { UserInfo } from '@/features/auth/auth.types';
/**
 * Attempt to refresh the session by querying the gateway /me endpoint.
 * Falls back to the current token if refresh fails.
 *
 * Returns the updated Session (with new accessToken) or null if no session exists.
 */
export async function refreshSessionIfNeeded(): Promise<Session | null> {
  if (typeof window === 'undefined') return null;

  const session = loadSession();
  if (!session?.accessToken || session.accessToken.startsWith('demo_token_')) {
    // Demo tokens cannot be refreshed
    return null;
  }

  // Note: Client-side JWT expiry check is intentionally skipped.
  // Keycloak in Docker may issue tokens with exp claims that are stale due to clock drift.
  // The /me endpoint below performs real token validation against Keycloak JWKS.

  try {
    const response = await axios.get<{
      sub: string;
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      roles: string[];
    }>(`${env.API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      timeout: 10_000,
    });

    const data = response.data;

    const userInfo: UserInfo = {
      sub: data.sub ?? '',
      username: data.username ?? 'unknown',
      preferred_username: data.username ?? 'unknown',
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      roles: (data.roles ?? []) as UserInfo['roles'],
    };

    return {
      accessToken: session.accessToken, // Token was valid (Keycloak may not rotate)
      user: userInfo,
    };
  } catch (error) {
    // Token is invalid or /me failed — user must re-login
    console.warn('[TokenRefresh] Session refresh failed:', error);
    return null;
  }
}
