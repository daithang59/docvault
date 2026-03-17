/**
 * Session storage — thin wrapper over localStorage.
 * Kept in features/auth for co-location; internally delegates to lib/auth/session.ts.
 */
export {
  loadSession,
  saveSession,
  clearSession,
} from '@/lib/auth/session';
