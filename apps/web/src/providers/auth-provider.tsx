'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Session } from '@/features/auth/auth.types';
import type { AuthContextValue } from '@/features/auth/auth.types';
import type { UserRole } from '@/types/enums';
import { saveSession, loadSession, clearSession } from '@/lib/auth/session';
import { hasRole, hasAnyRole } from '@/lib/auth/roles';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Defer reading localStorage until after client-side mount to avoid SSR mismatch.
  useEffect(() => {
    setSession(loadSession() as Session | null);
    setHydrated(true);
  }, []);

  const login = useCallback((newSession: Session) => {
    saveSession(newSession as Parameters<typeof saveSession>[0]);
    setSession(newSession);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    session,
    isAuthenticated: session !== null,
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
