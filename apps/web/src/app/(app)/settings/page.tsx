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
      <div className="grid gap-6 max-w-2xl">
        {/* Session info */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <User size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Phiên đăng nhập</h2>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <Row label="Username" value={user?.username ?? user?.sub ?? '—'} />
            <Row label="Subject (sub)" value={user?.sub ?? '—'} mono />
            <Row label="Loại phiên" value={user ? 'Authenticated' : 'Demo / Not logged in'} />
          </div>
        </div>

        {/* Roles */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Shield size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Vai trò hiện tại</h2>
          </div>
          <div className="px-5 py-4">
            {user?.roles && user.roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <RoleBadge key={role} role={role as UserRole} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Không có role nào được gán.</p>
            )}
          </div>
        </div>

        {/* Environment */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Globe size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Môi trường</h2>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
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
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-right truncate max-w-[280px] text-slate-700 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
