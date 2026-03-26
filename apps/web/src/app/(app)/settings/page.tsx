'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { PageShell } from '@/components/layout/page-shell';
import { RoleBadge } from '@/components/badges/role-badge';
import { User, Globe, Shield } from 'lucide-react';
import { UserRole } from '@/types/auth';

export default function SettingsPage() {
  const { session } = useAuth();
  const user = session?.user;

  return (
    <PageShell
      title="Thông tin hệ thống"
      description="Thông tin phiên đăng nhập và cấu hình môi trường"
    >
      <div className="grid max-w-2xl gap-6">
        {/* Session info */}
        <div className="rounded-lg border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
            <User size={18} className="text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">Phiên đăng nhập</h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <Row label="Username" value={user?.username ?? user?.sub ?? '—'} />
            <Row label="Subject (sub)" value={user?.sub ?? '—'} mono />
            <Row label="Loại phiên" value={user ? 'Authenticated' : 'Demo / Not logged in'} />
          </div>
        </div>

        {/* Roles */}
        <div className="rounded-lg border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
            <Shield size={18} className="text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">Vai trò hiện tại</h2>
          </div>
          <div className="px-5 py-4">
            {user?.roles && user.roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <RoleBadge key={role} role={role as UserRole} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Không có role nào được gán.</p>
            )}
          </div>
        </div>

        {/* Environment */}
        <div className="rounded-lg border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
            <Globe size={18} className="text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">Môi trường</h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <Row label="Ứng dụng" value={process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault'} />
            <Row
              label="API Gateway URL"
              value={process.env.NEXT_PUBLIC_API_BASE_URL ?? 'Chưa cấu hình'}
              mono
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span
        className={`max-w-[280px] truncate text-right text-[var(--text-main)] ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
