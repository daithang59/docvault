'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { PageShell } from '@/components/layout/page-shell';
import { RoleBadge } from '@/components/badges/role-badge';
import {
  Mail,
  Hash,
  Shield,
  ExternalLink,
  Loader2,
  AtSign,
  KeyRound,
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface UserProfile {
  sub: string;
  username: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles: string[];
}

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}

function InfoCard({ icon, label, value, mono, muted }: InfoCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3.5',
        'bg-[var(--bg-card)] transition-all duration-200',
        'hover:border-[var(--color-primary)]/30 hover:shadow-[0_0_0_1px_var(--color-primary)/10,0_2px_8px_var(--color-primary-glow)]',
      )}
      style={{ borderColor: 'var(--border-soft)' }}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
        <p
          className={cn(
            'mt-0.5 truncate text-sm font-medium',
            mono ? 'tabular-nums text-xs tracking-tight' : '',
            muted ? 'text-[var(--text-faint)]' : 'text-[var(--text-strong)]',
          )}
        >
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
    </div>
  );
}

export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [keycloakError, setKeycloakError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/users/profile');
        if (res.ok) {
          setProfile(await res.json());
        }
      } catch (err) {
        setKeycloakError('Không thể kết nối Keycloak. Thông tin có thể không đầy đủ.');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const displayName =
    profile?.displayName ??
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ??
    profile?.username ??
    user?.displayName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ??
    user?.preferred_username ??
    null;

  const avatarInitials =
    (profile?.firstName || user?.firstName) && (profile?.lastName || user?.lastName)
      ? `${(profile?.firstName ?? user?.firstName)?.[0]}${(profile?.lastName ?? user?.lastName)?.[0]}`.toUpperCase()
      : (profile?.username ?? user?.preferred_username ?? 'U').slice(0, 2).toUpperCase();

  const username = profile?.username ?? user?.username ?? user?.preferred_username ?? null;

  return (
    <PageShell
      title="Hồ sơ cá nhân"
      description="Thông tin tài khoản của bạn — được quản lý bởi Keycloak"
    >
      {/* ── Hero Card ───────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
          boxShadow: 'var(--surface-shadow-sm)',
        }}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--color-primary)' }}
        />

        <div className="relative flex items-center gap-5">
          {/* Avatar — filled gradient, no inner shadow */}
          <div className="relative shrink-0">
            <div
              className="absolute -inset-1 rounded-full opacity-40 blur-sm"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #8B5CF6)' }}
            />
            <div
              className="relative flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                border: '1.5px solid rgba(255,255,255,0.12)',
              }}
            >
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-[var(--color-primary)]" />
              ) : (
                <span className="text-2xl font-bold uppercase tracking-tight text-[var(--color-primary)]">
                  {avatarInitials}
                </span>
              )}
            </div>
            {/* Online dot */}
            <div
              className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-[1.5px]"
              style={{
                background: '#22C55E',
                borderColor: 'var(--bg-card)',
              }}
            >
              <span className="sr-only">Đang hoạt động</span>
            </div>
          </div>

          {/* Identity info */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-7 w-40 animate-pulse rounded-lg" style={{ background: 'var(--bg-muted)' }} />
                <div className="h-5 w-24 animate-pulse rounded-lg" style={{ background: 'var(--bg-muted)' }} />
              </div>
            ) : (
              <>
                {displayName && (
                  <h2 className="text-2xl font-bold leading-tight text-[var(--text-strong)]">
                    {displayName}
                  </h2>
                )}
                {username && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">@{username}</p>
                )}
                {user?.roles && user.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <RoleBadge key={role} role={role as UserRole} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Status badge (right side) */}
          {!loading && (
            <div className="hidden shrink-0 sm:flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Account Info ────────────────────────────────────── */}
      <SectionLabel>Thông tin tài khoản</SectionLabel>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          icon={<AtSign size={15} className="text-[var(--color-primary)]" />}
          label="Username"
          value={username ?? '—'}
          mono
        />
        <InfoCard
          icon={<Mail size={15} className="text-[var(--color-primary)]" />}
          label="Email"
          value={profile?.email ?? user?.email ?? '—'}
        />
        <InfoCard
          icon={<Hash size={15} className="text-[var(--color-primary)]" />}
          label="User ID"
          value={profile?.sub ?? user?.sub ?? '—'}
          mono
          muted
        />
        <InfoCard
          icon={<KeyRound size={15} className="text-[var(--color-primary)]" />}
          label="Xác thực"
          value="Keycloak SSO"
        />
      </div>

      {/* ── Roles ───────────────────────────────────────────── */}
      <SectionLabel>Vai trò &amp; quyền hạn</SectionLabel>

      <div
        className="relative overflow-hidden rounded-xl border p-5"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
            <Shield size={18} className="text-[var(--text-muted)]" />
          </div>
          {user?.roles && user.roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <RoleBadge key={role} role={role as UserRole} size="md" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Không có vai trò nào được gán.</p>
          )}
        </div>
      </div>

      {/* ── Keycloak Management ─────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl border p-5"
        style={{
          borderColor: 'var(--border-soft)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
          style={{ background: 'linear-gradient(180deg, var(--color-primary), #8B5CF6)' }}
        />

        <div className="flex gap-4 pl-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(139,92,246,0.1))' }}
          >
            <ExternalLink size={17} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                Quản lý tài khoản trên Keycloak
              </h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: 'rgba(37,99,235,0.08)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                Read-only
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
              Để thay đổi thông tin cá nhân (họ tên, email, mật khẩu), vui lòng truy cập{' '}
              <span className="font-medium text-[var(--text-main)]">Keycloak Admin Console</span>.
            </p>
            {keycloakError && (
              <p className="mt-2 text-xs text-red-500">{keycloakError}</p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
