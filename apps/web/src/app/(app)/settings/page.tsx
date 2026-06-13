'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { PageShell } from '@/components/layout/page-shell';
import { RoleBadge } from '@/components/badges/role-badge';
import {
  AlertTriangle,
  AtSign,
  CheckCircle,
  CircleAlert,
  Globe,
  Hash,
  KeyRound,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { cn } from '@/lib/utils/cn';
import { env } from '@/config/env';
import {
  buildSystemReadinessModel,
  type SystemReadinessState,
} from '@/features/system/system-readiness';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 mb-4 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
    </div>
  );
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

export default function SettingsPage() {
  const { session } = useAuth();
  const user = session?.user;
  const readiness = useMemo(
    () =>
      buildSystemReadinessModel({
        user,
        appName: env.APP_NAME,
        apiBaseUrl: env.API_BASE_URL,
      }),
    [user],
  );

  return (
    <PageShell
      title="System Information"
      description="Session details and environment configuration."
    >
      {/* ── Session Info ────────────────────────────────────── */}
      <div className="animate-in delay-1">
        <SectionLabel>Login Session</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            icon={<AtSign size={15} className="text-[var(--color-primary)]" />}
            label="Username"
            value={user?.username ?? user?.sub ?? '—'}
            mono
          />
          <InfoCard
            icon={<KeyRound size={15} className="text-[var(--color-primary)]" />}
            label="Session Type"
            value={user ? 'Authenticated (Keycloak SSO)' : 'Demo / Not logged in'}
          />
          <InfoCard
            icon={<Hash size={15} className="text-[var(--color-primary)]" />}
            label="User ID (sub)"
            value={user?.sub ?? '—'}
            mono
            muted
          />
        </div>
      </div>

      {/* ── Roles ───────────────────────────────────────────── */}
      <div className="animate-in delay-2">
        <SectionLabel>Roles &amp; Permissions</SectionLabel>
        <div
          className="relative overflow-hidden rounded-xl border p-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
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
              <p className="text-sm text-[var(--text-muted)]">No roles have been assigned.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Environment ──────────────────────────────────────── */}
      <div className="animate-in delay-3">
        <SectionLabel>Environment</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            icon={<User size={15} className="text-[var(--color-primary)]" />}
            label="Application"
            value={env.APP_NAME}
          />
          <InfoCard
            icon={<Globe size={15} className="text-[var(--color-primary)]" />}
            label="API Gateway URL"
            value={env.API_BASE_URL}
            mono
            muted
          />
        </div>
      </div>

      {/* ── Readiness ───────────────────────────────────────── */}
      <div className="animate-in delay-4">
        <SectionLabel>Product Readiness</SectionLabel>
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                <ShieldCheck size={18} className="text-[var(--color-primary)]" />
              </div>
              <span className="text-2xl font-bold text-[var(--text-strong)]">
                {readiness.score}%
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Commercial demo readiness
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">
              Based on session, roles, gateway config, and evidence export access.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {readiness.cards.map((card) => (
              <div
                key={card.key}
                className={cn(
                  'min-h-[132px] rounded-lg border p-3.5',
                  readinessStateClass(card.state),
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {card.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                      {card.value}
                    </p>
                  </div>
                  <ReadinessStateIcon state={card.state} />
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-4 rounded-lg border px-4 py-3.5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">
                Enabled capabilities
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                Capability list follows the active Keycloak role set.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
              {readiness.capabilities.length} active
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {readiness.capabilities.length === 0 ? (
              <p className="rounded-lg bg-[var(--bg-muted)] px-3 py-3 text-sm text-[var(--text-muted)]">
                No role-scoped capabilities are available in this session.
              </p>
            ) : (
              readiness.capabilities.map((capability) => (
                <div
                  key={capability.key}
                  className="flex min-w-0 gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2.5"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-main)]">
                      {capability.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                      {capability.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function ReadinessStateIcon({ state }: { state: SystemReadinessState }) {
  if (state === 'ready') {
    return <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (state === 'attention') {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />;
  }
  return <CircleAlert className="h-4 w-4 shrink-0 text-red-600" />;
}

function readinessStateClass(state: SystemReadinessState): string {
  if (state === 'ready') {
    return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20';
  }
  if (state === 'attention') {
    return 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20';
  }
  return 'border-red-200 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/20';
}
