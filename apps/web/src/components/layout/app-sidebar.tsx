'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X, Menu } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants/nav';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils/cn';
import { UserRole } from '@/types/auth';

// Extracted outside the render function to avoid re-creation on each render
function SidebarNav({
  pathname,
  session,
  visibleItems,
  onLinkClick,
}: {
  pathname: string;
  session: { user: { preferred_username?: string; username?: string; roles: string[] } } | null;
  visibleItems: typeof NAV_ITEMS;
  onLinkClick: () => void;
}) {
  const avatarInitials = (session?.user.preferred_username ?? session?.user.username ?? 'U').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Glassmorphism gradient overlay at top */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 px-6 py-5 border-b border-white/5">
        {/* Logo icon with glass effect */}
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB] to-[#4F46E5]" />
          <div className="absolute inset-0 bg-white/10" />
          <Shield className="relative h-4 w-4 text-white drop-shadow" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">DocVault</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Document System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                'sidebar-nav-item mb-0.5',
                isActive && 'active'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-blue-500 -ml-3" />
              )}
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-400' : 'text-slate-400')} />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)] shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {session && (
        <div className="relative px-4 py-4 border-t border-white/5">
          {/* Glow effect */}
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center gap-3 mt-2">
            {/* Avatar with gradient ring */}
            <div className="relative h-9 w-9 rounded-xl overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-violet-500/30" />
              <div className="absolute inset-0.5 rounded-[8px] bg-[#0F172A] flex items-center justify-center">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-tight">
                  {avatarInitials}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {session.user.preferred_username}
              </p>
              <p className="text-[11px] text-slate-400 truncate capitalize mt-0.5">
                {session.user.roles[0]?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) =>
    session?.user.roles.some((r) => (item.roles as UserRole[]).includes(r))
  );

  return (
    <>
      {/* Desktop sidebar — glassmorphism dark */}
      <aside className="hidden lg:flex flex-col w-[248px] h-screen sticky top-0 shrink-0 border-r border-white/5"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,1) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Subtle ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-500/[0.03] to-transparent" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-violet-500/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="relative flex flex-col h-full">
          <SidebarNav
            pathname={pathname}
            session={session}
            visibleItems={visibleItems}
            onLinkClick={() => setMobileOpen(false)}
          />
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl text-white transition-all active:scale-95"
        style={{
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex flex-col w-[280px] h-full z-10 shrink-0 border-r border-white/5"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,1) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-500/[0.04] to-transparent" />
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarNav
              pathname={pathname}
              session={session}
              visibleItems={visibleItems}
              onLinkClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
