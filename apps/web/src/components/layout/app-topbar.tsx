'use client';

import {
  Bell,
  CheckCheck,
  LogOut,
  ChevronDown,
  FileCheck,
  XCircle,
  Send,
  Archive,
  Inbox,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { RoleBadge } from '@/components/badges/role-badge';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { UserRole } from '@/types/auth';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/date';
import {
  fetchNotifications,
  markAllNotificationsRead,
  NotificationRecord,
} from '@/features/notifications/notifications.api';

const NOTIF_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SUBMITTED: { label: 'was submitted for review', Icon: Send, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300' },
  APPROVED:  { label: 'was approved', Icon: FileCheck, color: 'text-green-600 bg-green-50 dark:bg-green-950/50 dark:text-green-300' },
  REJECTED:  { label: 'was rejected', Icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
  ARCHIVED:  { label: 'was archived', Icon: Archive, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300' },
};

function NotificationItem({ notif }: { notif: NotificationRecord }) {
  const meta = NOTIF_META[notif.type] ?? NOTIF_META.SUBMITTED;
  const { Icon } = meta;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-muted)]/60',
        !notif.read && 'bg-[var(--color-primary-light)]/60',
      )}
    >
      <div className={cn('mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', meta.color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug text-[var(--text-main)]">
          Document <span className="font-medium text-[var(--text-strong)]">{notif.docId.slice(0, 8)}…</span> {meta.label}.
          {notif.reason && (
            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{notif.reason}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{formatRelative(notif.createdAt)}</p>
      </div>
      {!notif.read && (
        <span
          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-primary)]"
          style={{ boxShadow: '0 0 6px var(--color-primary-glow)' }}
        />
      )}
    </div>
  );
}

export function AppTopbar() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!notifOpen) return;

    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;

    fetchNotifications()
      .then((data) => {
        setNotifications(data);
        if (data.some((n) => !n.read)) {
          markAllNotificationsRead().catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [notifOpen]);

  function handleLogout() {
    logout();
    // Redirect to server-side logout that also ends Keycloak SSO session
    window.location.href = '/api/auth/logout';
  }

  function toggleNotifications() {
    setNotifOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotifLoading(true);
      }
      return next;
    });
  }

  const avatarInitials =
    session?.user.firstName && session?.user.lastName
      ? `${session.user.firstName[0]}${session.user.lastName[0]}`.toUpperCase()
      : (session?.user.preferred_username ?? 'U').slice(0, 2).toUpperCase();

  const displayName =
    session?.user.displayName ??
    ([session?.user.firstName, session?.user.lastName].filter(Boolean).join(' ') ||
      session?.user.preferred_username) ??
    'User';

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b px-6"
      style={{
        background: 'var(--surface-overlay)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'var(--surface-border)',
        boxShadow: 'var(--surface-shadow-sm)',
      }}
    >
      <div className="flex items-center gap-3">
        {session?.user.roles[0] && (
          <RoleBadge role={session.user.roles[0] as UserRole} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-95',
              notifOpen
                ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]',
            )}
            aria-label="Notifications"
          >
            <div className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-primary)]"
                  style={{ boxShadow: '0 0 6px var(--color-primary-glow)' }}
                />
              )}
            </div>
          </button>

          {notifOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
          )}
          {notifOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-2xl border"
              style={{
                background: 'var(--surface-overlay-strong)',
                borderColor: 'var(--surface-border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--surface-shadow-lg)',
              }}
            >
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
                <p className="text-sm font-semibold text-[var(--text-strong)]">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllNotificationsRead().catch(() => {});
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                    className="flex items-center gap-1 text-xs text-[var(--color-primary)] transition-colors hover:opacity-85"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="flex flex-col gap-2.5 px-4 py-5">
                    {[85, 60, 75].map((w, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-[var(--bg-muted)]" />
                        <div className="flex-1 space-y-1.5 pt-0.5">
                          <div className="h-3 w-full animate-pulse rounded bg-[var(--bg-muted)]" style={{ width: `${w}%` }} />
                          <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--bg-muted)]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-[var(--text-muted)]">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => <NotificationItem key={notif.id} notif={notif} />)
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-all active:scale-[0.98]',
              dropdownOpen
                ? 'bg-[var(--bg-muted)] text-[var(--text-strong)]'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-strong)]',
            )}
          >
            <div className="relative h-7 w-7 overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-500 opacity-20" />
              <div className="absolute inset-0.5 flex items-center justify-center rounded-[5px] bg-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-bold uppercase tracking-tight text-blue-400">{avatarInitials}</span>
              </div>
            </div>
            <span className="hidden text-sm font-medium md:block">{displayName}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200',
                dropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {dropdownOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
          )}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border"
              style={{
                background: 'var(--surface-overlay-strong)',
                borderColor: 'var(--surface-border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--surface-shadow-lg)',
              }}
            >
              <div className="border-b px-4 py-3.5" style={{ borderColor: 'var(--border-soft)' }}>
                <p className="text-sm font-semibold text-[var(--text-strong)]">{displayName}</p>
                {session?.user.email && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{session.user.email}</p>
                )}
                <p className="mt-0.5 text-xs text-[var(--text-faint)]">ID: {session?.user.sub?.slice(0, 8)}…</p>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); router.push('/profile'); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)]"
              >
                <User className="h-4 w-4" />
                View Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50/80 dark:text-red-300 dark:hover:bg-red-950/35"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
