'use client';

import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';
import { applyInterceptors } from '@/lib/api/interceptors';

// Apply interceptors synchronously on module load — BEFORE any component
// renders and triggers API calls. Guard prevents double-apply in Next.js HMR.
if (typeof window !== 'undefined') {
  applyInterceptors();
}

/** Root provider composition — mount once in app/layout.tsx */
export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
