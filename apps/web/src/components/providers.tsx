'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Toaster } from 'sonner';

// Shared QueryClient instance — imported by auth-provider for cache clearing on logout.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
