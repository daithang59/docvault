import axios from 'axios';
import { env } from '@/config/env';
import { loadSession } from './session';
import { parseJwt, extractRoles, extractUsername, extractUserId } from './token';
import type { Session } from '@/types/auth';
import type { UserInfo } from '@/features/auth/auth.types';
const REFRESH_THRESHOLD_SECONDS = 60; // Refresh if token expires in < 60s

function tokenExpiresSoon(token: string): boolean {
  try {
    const payload = parseJwt(token);
    if (!payload?.exp) return true;
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    return msUntilExpiry < REFRESH_THRESHOLD_SECONDS * 1000;
  } catch {
    return true;
  }
}

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

  // Only refresh if expiry is approaching
  if (!tokenExpiresSoon(session.accessToken)) {
    return null;
  }

  try {
    const response = await axios.get<{
      sub: string;
      username?: string;
      email?: string;
      realm_access?: { roles?: string[] };
    }>(`${env.API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      timeout: 10_000,
    });

    const data = response.data;
    const currentPayload = parseJwt(session.accessToken);

    // /me validates the token with Keycloak — if it returns 200, token is still valid.
    // We re-extract roles from the same token (not from /me which may not include all claims).
    // If /me returned a new token, use it; otherwise keep the current one.
    const newPayload = currentPayload;

    const userInfo: UserInfo = {
      sub: data.sub || extractUserId(newPayload!),
      username: data.username || extractUsername(newPayload!),
      preferred_username: data.username || extractUsername(newPayload!),
      email: data.email,
      roles: extractRoles(newPayload!),
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
