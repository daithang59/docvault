'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';
import { applyInterceptors } from '@/lib/api/interceptors';

/** Root provider composition — mount once in app/layout.tsx */
export function AppProvider({ children }: { children: React.ReactNode }) {
  // Apply axios interceptors on client mount
  useEffect(() => {
    applyInterceptors();
  }, []);

  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
