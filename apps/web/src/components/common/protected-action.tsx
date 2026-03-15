'use client';

import React from 'react';
import { UserRole } from '@/types/auth';
import { useAuth } from '@/lib/auth/auth-context';

interface ProtectedActionProps {
  roles?: UserRole[];
  condition?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProtectedAction({
  roles,
  condition = true,
  fallback = null,
  children,
}: ProtectedActionProps) {
  const { hasAnyRole } = useAuth();

  const roleAllowed = !roles || hasAnyRole(roles);
  const allowed = roleAllowed && condition;

  return allowed ? <>{children}</> : <>{fallback}</>;
}
