'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X, Menu } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants/nav';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils/cn';
import { UserRole } from '@/types/auth';

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) =>
    session?.roles.some((r) => (item.roles as UserRole[]).includes(r))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1E293B]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">DocVault</h1>
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Document System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest px-3 mb-3">
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
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-[#1E293B] text-white'
                  : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-[#60A5FA]' : 'text-[#94A3B8]')} />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {session && (
        <div className="px-4 py-4 border-t border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#1E293B] flex items-center justify-center">
              <span className="text-xs font-medium text-[#60A5FA] uppercase">
                {session.username.slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{session.username}</p>
              <p className="text-[11px] text-[#94A3B8] capitalize truncate">
                {session.roles[0]?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#0F172A] h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-[#0F172A] text-white shadow"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex flex-col w-60 bg-[#0F172A] h-full z-10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
