'use client';

import { Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { RoleBadge } from '@/components/badges/role-badge';
import { UserRole } from '@/types/auth';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

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

  const avatarInitials = (session?.user.preferred_username ?? 'U').slice(0, 2).toUpperCase();

  return (
    <header
      className="h-14 flex items-center justify-between px-6 sticky top-0 z-30 border-b"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'rgba(226,232,240,0.8)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Left: breadcrumb / page title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-500 lg:hidden">DocVault</span>
        <span className="hidden lg:block text-sm font-semibold text-slate-800">
          {currentLabel}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Role badge */}
        {session?.user.roles[0] && (
          <RoleBadge role={session.user.roles[0] as UserRole} />
        )}

        {/* Notifications — subtle glass button */}
        <button
          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
          aria-label="Notifications"
        >
          <div className="relative">
            <Bell className="h-4 w-4" />
            {/* Notification dot */}
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(37,99,235,0.6)]" />
          </div>
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all active:scale-[0.98]',
              dropdownOpen
                ? 'bg-slate-100 text-slate-800'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-800'
            )}
          >
            {/* Avatar with gradient ring */}
            <div className="relative h-7 w-7 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-500 opacity-20" />
              <div className="absolute inset-0.5 rounded-[5px] bg-slate-800 flex items-center justify-center">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">
                  {avatarInitials}
                </span>
              </div>
            </div>
            <span className="hidden md:block text-sm font-medium">{session?.user.preferred_username ?? 'User'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-2 z-20 w-52 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xl"
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                {/* User info */}
                <div className="px-4 py-3.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{session?.user.preferred_username}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID: {session?.user.sub?.slice(0, 8)}…
                  </p>
                </div>
                {/* Actions */}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/80 transition-colors"
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
