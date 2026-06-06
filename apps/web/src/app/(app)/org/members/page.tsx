'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, RefreshCw, Shield, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { useAuth } from '@/lib/auth/auth-context';
import { useMyOrg, useOrgMembers } from '@/features/org/org.hooks';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { formatDateTime } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

const roleStyles: Record<string, string> = {
  ADMIN: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  MEMBER: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
};

export default function OrgMembersPage() {
  const { session } = useAuth();
  const isAdmin = session?.user.roles.includes('admin') ?? false;

  const { org } = useMyOrg();
  const membersQuery = useOrgMembers(isAdmin);

  const members = membersQuery.data ?? [];
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const { data: displayNames } = useOwnerDisplayNames(memberIds);

  if (!isAdmin) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Admin role to manage organization members."
        action={
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <Shield size={13} />
            <span>Your current role does not have sufficient permissions.</span>
          </div>
        }
      />
    );
  }

  if (membersQuery.isLoading) return <LoadingState label="Loading members..." />;
  if (membersQuery.isError) {
    return (
      <ErrorState
        message="Failed to load organization members."
        onRetry={() => membersQuery.refetch()}
      />
    );
  }

  const adminCount = members.filter((m) => m.role === 'ADMIN').length;
  const summaryCards = [
    { label: 'Total members', value: members.length },
    { label: 'Admins', value: adminCount },
    { label: 'Members', value: members.length - adminCount },
  ];

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="People who belong to your organization and their roles."
        actions={
          <button
            type="button"
            onClick={() => membersQuery.refetch()}
            disabled={membersQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', membersQuery.isFetching && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      <section
        className="mb-5 flex items-center gap-3 rounded-lg border p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--color-primary)]">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            {org?.name ?? 'Organization'}
          </h2>
          <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
            Workspace slug: {org?.slug ?? '—'}
          </p>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <p className="text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{card.value}</p>
          </div>
        ))}
      </section>

      {members.length === 0 ? (
        <EmptyState
          icon="list"
          title="No members yet"
          description="Members appear here once they sign in to your organization."
        />
      ) : (
        <div
          className="overflow-hidden rounded-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-[var(--text-muted)]" style={{ borderColor: 'var(--border-soft)' }}>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const display = displayNames?.[member.userId];
                const name = display?.displayName ?? member.userId;
                const isSelf = member.userId === session?.user.sub;
                return (
                  <tr
                    key={member.userId}
                    className="border-b last:border-0"
                    style={{ borderColor: 'var(--border-soft)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--text-muted)]">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-strong)]">
                            {name}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-[var(--text-faint)]">(you)</span>
                            )}
                          </p>
                          {display?.username && display.username !== name && (
                            <p className="truncate text-xs text-[var(--text-faint)]">{display.username}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                          roleStyles[member.role] ?? roleStyles.MEMBER,
                        )}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {formatDateTime(member.joinedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
