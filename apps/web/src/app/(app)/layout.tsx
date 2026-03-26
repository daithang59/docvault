'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { ROUTES } from '@/lib/constants/routes';
import { LoadingState } from '@/components/common/loading-state';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, session, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return; // Wait for session to be restored from localStorage
    if (!isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, hydrated, router]);

  if (!hydrated || !isAuthenticated || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <LoadingState label="Signing you in..." />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
