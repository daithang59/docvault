import { apiClient } from './client';
import { parseApiError } from './errors';
import { loadSession } from '@/lib/auth/session';

/**
 * Apply request/response interceptors to the shared axios instance.
 * Call this once at app startup (e.g., in AppProvider).
 */
export function applyInterceptors(): void {
  // ── Request: inject Bearer token ──────────────────────────────────────────
  apiClient.interceptors.request.use((config) => {
    const session = loadSession();
    if (session?.accessToken) {
      config.headers['Authorization'] = `Bearer ${session.accessToken}`;
    }
    return config;
  });

  // ── Response: normalize errors, handle 401 ────────────────────────────────
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      const apiError = parseApiError(error);

      // Optionally handle 401 by redirecting to login
      if (apiError.isUnauthorized() && typeof window !== 'undefined') {
        // Avoid redirect loops when already on login page
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      return Promise.reject(apiError);
    },
  );
}
