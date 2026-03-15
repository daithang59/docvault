'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import { Session, UserRole, AuthContextValue } from '@/types/auth';
import { saveSession, loadSession, clearSession } from './auth-storage';
import { hasRole, hasAnyRole } from './guards';

const AuthContext = createContext<AuthContextValue | null>(null);

// Initialize session from storage lazily to avoid setState-in-effect pattern
function initSession(): Session | null {
  return loadSession();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(initSession);

  const login = useCallback((newSession: Session) => {
    saveSession(newSession);
    setSession(newSession);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    session,
    login,
    logout,
    isAuthenticated: session !== null,
    hasRole: (role: UserRole) => hasRole(session, role),
    hasAnyRole: (roles: UserRole[]) => hasAnyRole(session, roles),
    isViewer: hasRole(session, 'viewer'),
    isEditor: hasRole(session, 'editor'),
    isApprover: hasRole(session, 'approver'),
    isComplianceOfficer: hasRole(session, 'compliance_officer'),
    isAdmin: hasRole(session, 'admin'),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
