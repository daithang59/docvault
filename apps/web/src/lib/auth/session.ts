/**
 * Session storage helpers — persists auth session to localStorage.
 * Separate from the auth context so it can be imported by the axios interceptor
 * without pulling in React dependencies.
 */

import type { Session } from '@/types/auth';

const SESSION_KEY = 'docvault_session';

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
