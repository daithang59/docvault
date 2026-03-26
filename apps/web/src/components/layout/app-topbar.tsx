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
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { RoleBadge } from '@/components/badges/role-badge';
import { UserRole } from '@/types/auth';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/date';
import {
  fetchNotifications,
  markAllNotificationsRead,
  NotificationRecord,
} from '@/features/notifications/notifications.api';

const pathLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/documents': 'Documents',
  '/documents/new': 'New Document',
  '/approvals': 'Approvals',
  '/audit': 'Audit',
};

const NOTIF_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SUBMITTED: { label: 'đã gửi duyệt', Icon: Send, color: 'text-blue-500 bg-blue-50' },
  APPROVED:  { label: 'đã được phê duyệt', Icon: FileCheck, color: 'text-green-600 bg-green-50' },
  REJECTED:  { label: 'đã bị từ chối', Icon: XCircle, color: 'text-red-500 bg-red-50' },
  ARCHIVED:  { label: 'đã được lưu trữ', Icon: Archive, color: 'text-slate-500 bg-slate-50' },
};

function NotificationItem({ notif }: { notif: NotificationRecord }) {
  const meta = NOTIF_META[notif.type] ?? NOTIF_META['SUBMITTED'];
  const { Icon } = meta;
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors', !notif.read && 'bg-blue-50/30')}>
      <div className={cn('mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', meta.color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-snug">
          Tài liệu <span className="font-medium text-slate-900">{notif.docId.slice(0, 8)}…</span> {meta.label}.
          {notif.reason && (
            <span className="block text-xs text-slate-400 mt-0.5 truncate">{notif.reason}</span>
          )}
        </p>
        <p className="text-xs text-slate-400 mt-1">{formatRelative(notif.createdAt)}</p>
      </div>
      {!notif.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />}
    </div>
  );
}

export function AppTopbar() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    Object.entries(pathLabels).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? 'DocVault';

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close panel on outside click
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

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!notifOpen) return;
    setNotifLoading(true);
    fetchNotifications()
      .then((data) => {
        setNotifications(data);
        // Auto-mark read if there are unread
        if (data.some((n) => !n.read)) {
          markAllNotificationsRead().catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [notifOpen]);

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

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={cn(
              'h-8 w-8 rounded-xl flex items-center justify-center transition-all active:scale-95',
              notifOpen
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            )}
            aria-label="Notifications"
          >
            <div className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(37,99,235,0.6)]" />
              )}
            </div>
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotifOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-2 z-20 w-80 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xl"
                style={{
                  background: 'rgba(255,255,255,0.97)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">Thông báo</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        markAllNotificationsRead().catch(() => {});
                        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                      }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                      Đang tải…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                      <Inbox className="h-8 w-8 opacity-40" />
                      <p className="text-sm">Không có thông báo nào</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <NotificationItem key={notif.id} notif={notif} />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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
