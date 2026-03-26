'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Session } from '@/features/auth/auth.types';
import type { AuthContextValue } from '@/features/auth/auth.types';
import type { UserRole } from '@/types/enums';
import { saveSession, loadSession, clearSession } from '@/lib/auth/session';
import { hasRole, hasAnyRole } from '@/lib/auth/roles';
import { queryClient } from '@/providers/query-provider';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === 'undefined') return null;
    return loadSession() as Session | null;
  });
  const [hydrated] = useState(true);

  const login = useCallback((newSession: Session) => {
    saveSession(newSession as Parameters<typeof saveSession>[0]);
    setSession(newSession);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    queryClient.clear();        // Wipe all cached queries so no stale data leaks into the next session
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    session,
    isAuthenticated: session !== null,
    hydrated,
    login,
    logout,
    hasRole: (role: UserRole) => hasRole(session as Parameters<typeof hasRole>[0], role),
    hasAnyRole: (roles: UserRole[]) => hasAnyRole(session as Parameters<typeof hasAnyRole>[0], roles),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
