'use client';

import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50/50">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto">
          {/* Subtle gradient fade at top of content */}
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
