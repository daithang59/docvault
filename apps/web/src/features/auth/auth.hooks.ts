'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ROUTES } from '@/lib/constants/routes';

/** Returns the current session and a flag indicating if authentication was checked */
export function useSession() {
  const { session, isAuthenticated } = useAuth();
  return { session, isAuthenticated };
}

/** Redirects to login if not authenticated; returns session when ready */
export function useRequireAuth() {
  const { session, isAuthenticated } = useAuth();
  const router = useRouter();

  const ensureAuth = useCallback(() => {
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, router]);

  return { session, isAuthenticated, ensureAuth };
}
