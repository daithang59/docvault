'use client';

import { Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { RoleBadge } from '@/components/badges/role-badge';
import { UserRole } from '@/types/auth';
import { useState } from 'react';

const pathLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/documents': 'Documents',
  '/documents/new': 'New Document',
  '/approvals': 'Approvals',
  '/audit': 'Audit',
};

export function AppTopbar() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentLabel =
    Object.entries(pathLabels).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? 'DocVault';

  function handleLogout() {
    logout();
    router.push(ROUTES.LOGIN);
  }

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: breadcrumb / page title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[#64748B] lg:hidden">DocVault</span>
        <span className="hidden lg:block text-sm font-medium text-[#0F172A]">
          {currentLabel}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        {session?.roles[0] && (
          <RoleBadge role={session.roles[0] as UserRole} />
        )}

        {/* Notifications placeholder */}
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-sm font-medium text-[#1E293B]"
          >
            <div className="h-7 w-7 rounded-full bg-[#1E293B] flex items-center justify-center">
              <span className="text-xs font-semibold text-[#60A5FA] uppercase">
                {session?.username?.slice(0, 2) ?? 'U'}
              </span>
            </div>
            <span className="hidden md:block">{session?.username ?? 'User'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white rounded-xl border border-[#E2E8F0] shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F1F5F9]">
                  <p className="text-xs font-medium text-[#1E293B]">{session?.username}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    ID: {session?.userId?.slice(0, 8)}…
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
