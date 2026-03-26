'use client';

import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from 'sonner';
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
          <Toaster
            position="bottom-right"
            gap={8}
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text-main)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--surface-shadow-lg)',
                borderRadius: '16px',
                padding: '14px 18px',
                fontSize: '13px',
                fontWeight: '500',
              },
              classNames: {
                success: 'toast-success',
                error: 'toast-error',
                info: 'toast-info',
              },
            }}
          />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
