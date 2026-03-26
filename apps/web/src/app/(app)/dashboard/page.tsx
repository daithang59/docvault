'use client';

import { useMemo } from 'react';
import { useDocuments } from '@/lib/hooks/use-documents';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/common/page-header';
import { RoleBadge } from '@/components/badges/role-badge';
import { StatusBadge } from '@/components/badges/status-badge';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ProtectedAction } from '@/components/common/protected-action';
import { FileText, FilePlus, CheckSquare, Shield, ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { UserRole } from '@/types/auth';
import { truncateEnd } from '@/lib/utils/format';

export default function DashboardPage() {
  const { session } = useAuth();
  const { data: docs, isLoading, isError, refetch } = useDocuments();

  const stats = useMemo(() => {
    if (!docs) return { total: 0, DRAFT: 0, PENDING: 0, PUBLISHED: 0, ARCHIVED: 0 };
    return docs.data.reduce(
      (acc: Record<string, number>, d) => { acc.total++; acc[d.status]++; return acc; },
      { total: 0, DRAFT: 0, PENDING: 0, PUBLISHED: 0, ARCHIVED: 0 }
    );
  }, [docs]);

  const recentDocs = useMemo(
    () => [...(docs?.data ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [docs]
  );

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError) return <ErrorState message="Failed to load dashboard data." onRetry={refetch} />;

  const STAT_CARDS = [
    { label: 'Total Documents', value: stats.total, icon: FileText, statKey: 'total' },
    { label: 'Draft',           value: stats.DRAFT,    icon: FileText,   statKey: 'draft'    },
    { label: 'Pending Approval',value: stats.PENDING,  icon: TrendingUp, statKey: 'pending' },
    { label: 'Published',       value: stats.PUBLISHED, icon: Shield,    statKey: 'published'},
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="System overview and quick access to your documents."
        badge={session?.user.roles[0] ? <RoleBadge role={session.user.roles[0] as UserRole} /> : null}
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border p-5"
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

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent documents */}
        <div className="lg:col-span-2">
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
              {recentDocs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No documents yet.
                </p>
              ) : (
                recentDocs.map((doc) => (
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
        <div>
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
                  description={`${stats.PENDING} pending`}
                  badge={stats.PENDING > 0 ? String(stats.PENDING) : undefined}
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
      className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 transition-all hover:border-[var(--border-soft)]"
      style={{ borderColor: 'transparent' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
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
        className="h-3.5 w-3.5 shrink-0 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      />
    </Link>
  );
}
