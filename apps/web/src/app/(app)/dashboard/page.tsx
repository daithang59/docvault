'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/badges/status-badge';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ProtectedAction } from '@/components/common/protected-action';
import { fetchUnreadCount } from '@/features/notifications/notifications.api';
import {
  buildDashboardModel,
  type DashboardDemoReadinessSignal,
  type DashboardOperationalWidget,
  type DashboardWidgetTone,
} from '@/features/dashboard/dashboard-model';
import { cn } from '@/lib/utils/cn';
import {
  Archive,
  Bell,
  FileText,
  FilePlus,
  CheckSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { truncateEnd } from '@/lib/utils/format';

export default function DashboardPage() {
  const { session } = useAuth();
  const { data: docs, isLoading, isError, refetch } = useDocuments();
  const documents = docs?.data;
  const userId = session?.user.sub;
  const userRoles = session?.user.roles;
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count', 'dashboard'],
    queryFn: fetchUnreadCount,
    enabled: !isLoading,
    retry: false,
  });
  const unreadCount = unreadQuery.data?.count ?? 0;

  const dashboard = useMemo(
    () =>
      buildDashboardModel(documents ?? [], {
        unreadNotifications: unreadCount,
        actor: userId && userRoles
          ? { id: userId, roles: userRoles }
          : undefined,
      }),
    [documents, unreadCount, userId, userRoles],
  );

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError) return <ErrorState message="Failed to load dashboard data." onRetry={refetch} />;

  const STAT_CARDS = [
    { label: 'Total Documents', value: dashboard.stats.total, icon: FileText, statKey: 'total' },
    { label: 'Draft',           value: dashboard.stats.DRAFT,    icon: FileText,   statKey: 'draft'    },
    { label: 'Pending Approval',value: dashboard.stats.PENDING,  icon: TrendingUp, statKey: 'pending' },
    { label: 'Published',       value: dashboard.stats.PUBLISHED, icon: Shield,    statKey: 'published'},
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="System overview and quick access to your documents."
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`animate-in card-interactive rounded-2xl border p-5 delay-${idx + 1}`}
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <div
                className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: `var(--stat-${card.statKey}-bg)`,
                  color: `var(--stat-${card.statKey}-text)`,
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-strong)' }}>
                {card.value}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {card.label}
              </p>
            </div>
          );
        })}
      </div>

      <div
        data-testid="business-demo-readiness"
        className="mb-6 overflow-hidden rounded-lg border"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div
            className="border-b px-5 py-4 xl:border-b-0 xl:border-r"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                  <ShieldCheck className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-strong)]">
                    Business Demo Readiness
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                    {dashboard.demoReadiness.label}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-2xl font-bold text-[var(--text-strong)]">
                {dashboard.demoReadiness.score}%
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
              {dashboard.demoReadiness.description}
            </p>
          </div>

          <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.demoReadiness.signals.map((signal) => (
              <DemoReadinessSignalCard key={signal.key} signal={signal} />
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.operationalWidgets.map((widget) => (
          <OperationalWidgetCard key={widget.key} widget={widget} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent documents */}
        <div className="lg:col-span-2 animate-in delay-5">
          <div
            className="mb-5 overflow-hidden rounded-2xl border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Operational Work Queue</h2>
              <Link
                href={ROUTES.NOTIFICATIONS}
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-primary)' }}
              >
                Open notifications <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {dashboard.workQueue.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No operational work items.
                </p>
              ) : (
                dashboard.workQueue.map((item) => (
                  <Link
                    key={`${item.documentId}-${item.reason}`}
                    href={item.href}
                    className="grid gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-muted)]/50 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                        {truncateEnd(item.title, 60)}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {item.reason}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                        {item.actionLabel}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex h-7 items-center justify-center rounded-full border px-2.5 text-xs font-semibold capitalize',
                        toneClass(item.tone),
                      )}
                    >
                      {item.tone}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Recent Documents</h2>
              <Link
                href={ROUTES.DOCUMENTS}
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-primary)' }}
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {dashboard.recentDocuments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No documents yet.
                </p>
              ) : (
                dashboard.recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={ROUTES.DOCUMENT_DETAIL(doc.id)}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-muted)]/50"
                    style={{ borderColor: 'var(--border-soft)' }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--bg-muted)' }}
                    >
                      <FileText className="h-4 w-4" style={{ color: 'var(--text-faint)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                        {truncateEnd(doc.title, 50)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDateTime(doc.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="animate-in delay-5">
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div
              className="border-b px-5 py-4"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Quick Actions</h2>
            </div>
            <div className="space-y-2 p-5">
              <QuickAction
                href={ROUTES.DOCUMENTS}
                icon={FileText}
                label="Browse Documents"
                description="View all documents"
              />
              <ProtectedAction roles={['editor', 'admin']}>
                <QuickAction
                  href={ROUTES.DOCUMENTS_NEW}
                  icon={FilePlus}
                  label="Create Document"
                  description="Upload a new document"
                />
              </ProtectedAction>
              <ProtectedAction roles={['approver', 'admin']}>
                <QuickAction
                  href={ROUTES.APPROVALS}
                  icon={CheckSquare}
                  label="Review Approvals"
                  description={`${dashboard.stats.PENDING} pending`}
                  badge={dashboard.stats.PENDING > 0 ? String(dashboard.stats.PENDING) : undefined}
                />
              </ProtectedAction>
              <ProtectedAction roles={['compliance_officer']}>
                <QuickAction
                  href={ROUTES.AUDIT}
                  icon={Shield}
                  label="Audit Logs"
                  description="View security events"
                />
              </ProtectedAction>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, description, badge }: {
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 transition-all hover:border-[var(--border-soft)] hover:bg-[var(--bg-card-hover)]"
      style={{ borderColor: 'transparent' }}
    >
      <div
        className="qa-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all"
        style={{ background: 'var(--bg-muted)' }}
      >
        <Icon
          className="h-4 w-4 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      {badge && (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          {badge}
        </span>
      )}
      <ArrowRight
        className="qa-arrow h-3.5 w-3.5 shrink-0"
        style={{ color: 'var(--text-muted)' }}
      />
    </Link>
  );
}

const WIDGET_ICONS: Record<DashboardOperationalWidget['key'], LucideIcon> = {
  'pending-approvals': CheckSquare,
  'dlp-detected': ShieldAlert,
  'retention-due-soon': Archive,
  'unread-notifications': Bell,
};

const DEMO_SIGNAL_ICONS: Record<DashboardDemoReadinessSignal['key'], LucideIcon> = {
  'lifecycle-coverage': FileText,
  'approval-workflow': CheckSquare,
  'evidence-export': Archive,
  'security-posture': ShieldAlert,
};

function DemoReadinessSignalCard({
  signal,
}: {
  signal: DashboardDemoReadinessSignal;
}) {
  const Icon = DEMO_SIGNAL_ICONS[signal.key];

  return (
    <Link
      href={signal.href}
      className="group flex min-h-[132px] min-w-0 flex-col justify-between bg-[var(--bg-card)] p-4 transition hover:bg-[var(--bg-card-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {signal.label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
            {signal.value}
          </p>
        </div>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
            toneClass(signal.tone),
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
          {signal.description}
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)]">
          Open <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </p>
      </div>
    </Link>
  );
}

function OperationalWidgetCard({
  widget,
}: {
  widget: DashboardOperationalWidget;
}) {
  const Icon = WIDGET_ICONS[widget.key];

  return (
    <Link
      href={widget.href}
      className="rounded-2xl border p-4 transition hover:bg-[var(--bg-card-hover)]"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {widget.label}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-strong)]">
            {widget.value}
          </p>
        </div>
        <div
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            toneClass(widget.tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
        {widget.description}
      </p>
    </Link>
  );
}

function toneClass(tone: DashboardWidgetTone): string {
  if (tone === 'critical') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300';
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300';
}
