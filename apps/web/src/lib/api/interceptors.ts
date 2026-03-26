import { apiClient } from './client';
import { parseApiError } from './errors';
import { clearSession, loadSession, saveSession } from '@/lib/auth/session';
import { refreshSessionIfNeeded } from '@/lib/auth/refresh';

let interceptorsApplied = false;

/**
 * Apply request/response interceptors to the shared axios instance.
 * Call this once at app startup (e.g., in AppProvider).
 */
export function applyInterceptors(): void {
  if (interceptorsApplied) return;
  interceptorsApplied = true;

  // ── Request: inject Bearer token ──────────────────────────────────────────
  apiClient.interceptors.request.use((config) => {
    const session = loadSession();
    if (session?.accessToken) {
      config.headers['Authorization'] = `Bearer ${session.accessToken}`;
    }
    return config;
  });

  // ── Response: normalize errors, handle 401 with refresh ──────────────────
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const apiError = parseApiError(error);

      if (apiError.isUnauthorized() && typeof window !== 'undefined') {
        // Attempt token refresh on 401
        const refreshed = await refreshSessionIfNeeded();
        if (refreshed) {
          saveSession(refreshed);
          // Retry the original request with the new token
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
          return apiClient(originalRequest);
        }

        // Refresh failed — clear session and redirect to login
        clearSession();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      return Promise.reject(apiError);
    },
  );
}
