'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X, Menu } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants/nav';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils/cn';
import { UserRole } from '@/types/auth';

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
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Glassmorphism gradient overlay at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--color-primary)]/[0.07] to-transparent" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 border-b px-6 py-5" style={{ borderColor: 'var(--sidebar-border)' }}>
        {/* Logo icon with glass effect */}
        <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB] to-[#4F46E5]" />
          <div className="absolute inset-0 bg-white/10" />
          <Shield className="relative h-4 w-4 text-white drop-shadow" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-[var(--sidebar-text-active)]">DocVault</h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--sidebar-text)]">Document System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-text)]" style={{ opacity: 0.6 }}>
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
                isActive && 'active',
              )}
            >
              {/* Active indicator — always rendered, animated via CSS */}
              <span
                className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: `translateY(-50%) scaleY(${isActive ? 1 : 0.3})`,
                }}
              />
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors duration-200', isActive ? 'text-[var(--color-primary)]' : 'text-[var(--sidebar-text)]')} />
              <span className="flex-1">{item.label}</span>
              {/* Active dot — always rendered, animated */}
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: `scale(${isActive ? 1 : 0})`,
                  boxShadow: isActive ? '0 0 6px var(--color-primary-glow)' : 'none',
                }}
              />
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {session && (
        <div className="relative px-4 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-violet-500/30" />
              <div className="absolute inset-0.5 flex items-center justify-center rounded-[8px] bg-[var(--sidebar-bg)]">
                <span className="text-[11px] font-bold uppercase tracking-tight text-[var(--color-primary)]">
                  {avatarInitials}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-[var(--sidebar-text-active)]">
                {session.user.preferred_username}
              </p>
              <p className="mt-0.5 truncate text-[11px] capitalize text-[var(--sidebar-text)]">
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
      <aside
        className="hidden lg:flex w-[248px] shrink-0 flex-col border-r"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,1) 100%)',
          borderColor: 'var(--sidebar-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          height: '100dvh',
          position: 'sticky',
          top: 0,
        }}
      >
        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--color-primary)]/[0.04] to-transparent" />
          <div className="absolute bottom-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-violet-500/[0.03]" style={{ filter: 'blur(24px)' }} />
        </div>

        <div className="relative flex h-full flex-col">
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
        className="lg:hidden fixed left-4 top-4 z-40 rounded-xl p-2.5 text-white transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative z-10 flex w-[280px] shrink-0 flex-col border-r"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,1) 100%)',
              borderColor: 'var(--sidebar-border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              height: '100dvh',
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--color-primary)]/[0.05] to-transparent" />
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-20 flex items-center justify-center rounded-lg p-1 text-[var(--sidebar-text)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text-active)]"
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
