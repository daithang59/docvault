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
    return docs.reduce(
      (acc: Record<string, number>, d) => { acc.total++; acc[d.status]++; return acc; },
      { total: 0, DRAFT: 0, PENDING: 0, PUBLISHED: 0, ARCHIVED: 0 }
    );
  }, [docs]);

  const recentDocs = useMemo(
    () => [...(docs ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [docs]
  );

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError) return <ErrorState message="Failed to load dashboard data." onRetry={refetch} />;

  const STAT_CARDS = [
    { label: 'Total Documents', value: stats.total, icon: FileText, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]' },
    { label: 'Draft', value: stats.DRAFT, icon: FileText, color: 'text-[#334155]', bg: 'bg-[#F1F5F9]' },
    { label: 'Pending Approval', value: stats.PENDING, icon: TrendingUp, color: 'text-[#92400E]', bg: 'bg-[#FEF3C7]' },
    { label: 'Published', value: stats.PUBLISHED, icon: Shield, color: 'text-[#166534]', bg: 'bg-[#DCFCE7]' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="System overview and quick access to your documents."
        badge={session?.roles[0] ? <RoleBadge role={session.roles[0] as UserRole} /> : null}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} mb-3`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{card.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Recent documents */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#0F172A]">Recent Documents</h2>
              <Link href={ROUTES.DOCUMENTS} className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-[#F8FAFC]">
              {recentDocs.length === 0 ? (
                <p className="text-sm text-[#94A3B8] px-5 py-8 text-center">No documents yet.</p>
              ) : (
                recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={ROUTES.DOCUMENT_DETAIL(doc.id)}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-[#94A3B8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1E293B] truncate">{truncateEnd(doc.title, 50)}</p>
                      <p className="text-xs text-[#94A3B8]">{formatDateTime(doc.updatedAt)}</p>
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
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#0F172A]">Quick Actions</h2>
            </div>
            <div className="p-5 space-y-2">
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
              <ProtectedAction roles={['compliance_officer', 'admin']}>
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all group"
    >
      <div className="h-8 w-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0 group-hover:bg-[#EFF6FF] transition-colors">
        <Icon className="h-4 w-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1E293B]">{label}</p>
        <p className="text-xs text-[#94A3B8]">{description}</p>
      </div>
      {badge && (
        <span className="text-xs font-bold text-white bg-[#2563EB] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
    </Link>
  );
}
