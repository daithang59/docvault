'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { ROUTES } from '@/lib/constants/routes';
import { LoadingState } from '@/components/common/loading-state';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, session, hydrated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, hydrated, router]);

  // Render shell immediately on server; content is determined client-side after mount
  return (
    <AppShell>
      {!mounted || !hydrated || !isAuthenticated || !session ? (
        <div className="flex h-[100dvh] items-center justify-center">
          <LoadingState label="Signing you in..." />
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}
