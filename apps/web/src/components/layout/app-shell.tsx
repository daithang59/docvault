'use client';

import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { CommandPalette } from '@/components/command-palette/command-palette';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)]">
      <CommandPalette />
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden h-full">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="page-content max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
