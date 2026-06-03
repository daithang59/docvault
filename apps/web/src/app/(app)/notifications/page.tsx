'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Bell,
  CheckCheck,
  CheckSquare,
  Circle,
  CircleCheck,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markAsRead,
  type NotificationPage,
} from '@/features/notifications/notifications.api';
import {
  buildNotificationCenterModel,
  type NotificationCenterFilter,
  type NotificationCenterItem,
  type NotificationGroupKey,
  type NotificationGroupSummary,
  type NotificationReadState,
  type NotificationSeverity,
} from '@/features/notifications/notifications-center';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelative } from '@/lib/utils/date';

const PAGE_SIZE = 50;
const LIST_QUERY_KEY = ['notifications', 'list', 1, PAGE_SIZE] as const;

const DEFAULT_FILTER: NotificationCenterFilter = {
  group: 'all',
  readState: 'all',
};

const GROUP_META: Record<
  NotificationGroupKey,
  { Icon: LucideIcon; description: string }
> = {
  all: {
    Icon: Bell,
    description: 'All routed work items',
  },
  approvals: {
    Icon: CheckSquare,
    description: 'Review and workflow decisions',
  },
  retention: {
    Icon: Archive,
    description: 'Lifecycle and archive posture',
  },
  security: {
    Icon: ShieldAlert,
    description: 'DLP, malware, and audit risks',
  },
  documents: {
    Icon: FileText,
    description: 'Document lifecycle updates',
  },
};

const READ_FILTERS: Array<{ value: NotificationReadState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
  critical:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] =
    useState<NotificationCenterFilter>(DEFAULT_FILTER);

  const notificationsQuery = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: () => fetchNotifications(1, PAGE_SIZE),
  });

  const records = useMemo(
    () => notificationsQuery.data?.records ?? [],
    [notificationsQuery.data?.records],
  );
  const model = useMemo(
    () => buildNotificationCenterModel(records, filter),
    [filter, records],
  );

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: LIST_QUERY_KEY });
      const previous =
        queryClient.getQueryData<NotificationPage>(LIST_QUERY_KEY);

      queryClient.setQueryData<NotificationPage>(LIST_QUERY_KEY, (current) =>
        current
          ? {
              ...current,
              records: current.records.map((record) =>
                record.id === id ? { ...record, read: true } : record,
              ),
            }
          : current,
      );

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LIST_QUERY_KEY, context.previous);
      }
      toast.error('Could not mark notification as read.');
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: LIST_QUERY_KEY });
      const previous =
        queryClient.getQueryData<NotificationPage>(LIST_QUERY_KEY);

      queryClient.setQueryData<NotificationPage>(LIST_QUERY_KEY, (current) =>
        current
          ? {
              ...current,
              records: current.records.map((record) => ({
                ...record,
                read: true,
              })),
            }
          : current,
      );

      return { previous };
    },
    onSuccess: () => {
      toast.success('All notifications marked as read.');
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LIST_QUERY_KEY, context.previous);
      }
      toast.error('Could not mark all notifications as read.');
    },
  });

  function handleGroupChange(group: NotificationGroupKey) {
    setFilter((current) => ({ ...current, group }));
  }

  function handleReadStateChange(readState: NotificationReadState) {
    setFilter((current) => ({ ...current, readState }));
  }

  function handleMarkRead(item: NotificationCenterItem) {
    if (item.read || markReadMutation.isPending) return;
    markReadMutation.mutate(item.id);
  }

  if (notificationsQuery.isLoading) {
    return <LoadingState label="Loading notification center..." />;
  }

  if (notificationsQuery.isError) {
    return (
      <ErrorState
        message="Failed to load notifications."
        onRetry={notificationsQuery.refetch}
      />
    );
  }

  return (
    <div>
      <div className="animate-in delay-1">
        <PageHeader
          title="Notifications"
          subtitle="Actionable work queue for approvals, retention, security, and document events."
          badge={
            model.unread > 0 ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white bg-[var(--color-primary)]">
                {model.unread} unread
              </span>
            ) : null
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => notificationsQuery.refetch()}
                disabled={notificationsQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    notificationsQuery.isFetching && 'animate-spin',
                  )}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={model.unread === 0 || markAllMutation.isPending}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
            </>
          }
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {model.groupSummaries.map((summary) => (
          <NotificationSummaryCard
            key={summary.key}
            summary={summary}
            selected={filter.group === summary.key}
            onSelect={() => handleGroupChange(summary.key)}
          />
        ))}
      </div>

      <div
        className="mb-4 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Queue filters
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Current view: {filter.group} / {filter.readState}
          </p>
        </div>
        <div
          className="inline-flex w-full rounded-lg border p-1 sm:w-auto"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          {READ_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter.readState === option.value}
              onClick={() => handleReadStateChange(option.value)}
              className={cn(
                'min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition sm:flex-none',
                filter.readState === option.value
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in delay-2">
        {records.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Workflow, retention, security, and document events will appear here."
            icon="list"
          />
        ) : model.items.length === 0 ? (
          <EmptyState
            title="No notifications match these filters"
            description="Switch queue group or read state to inspect other work items."
            icon="search"
          />
        ) : (
          <NotificationList
            items={model.items}
            total={notificationsQuery.data?.total ?? records.length}
            page={notificationsQuery.data?.page ?? 1}
            pages={notificationsQuery.data?.pages ?? 1}
            onMarkRead={handleMarkRead}
            pendingId={
              markReadMutation.isPending
                ? String(markReadMutation.variables)
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function NotificationSummaryCard({
  summary,
  selected,
  onSelect,
}: {
  summary: NotificationGroupSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { Icon, description } = GROUP_META[summary.key];

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'min-h-32 rounded-lg border p-4 text-left transition',
        selected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
          : 'hover:bg-[var(--bg-muted)]',
      )}
      style={{
        background: selected ? undefined : 'var(--bg-card)',
        borderColor: selected ? undefined : 'var(--border-soft)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          {summary.label}
        </p>
        <Icon className="h-4 w-4 text-[var(--text-faint)]" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
        {summary.total}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {summary.unread} unread
      </p>
      <p className="mt-3 min-h-8 text-xs leading-snug text-[var(--text-faint)]">
        {description}
      </p>
    </button>
  );
}

function NotificationList({
  items,
  total,
  page,
  pages,
  pendingId,
  onMarkRead,
}: {
  items: NotificationCenterItem[];
  total: number;
  page: number;
  pages: number;
  pendingId?: string;
  onMarkRead: (item: NotificationCenterItem) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="divide-y" style={{ borderColor: 'var(--table-row-border)' }}>
        {items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            isPending={pendingId === item.id}
            onMarkRead={() => onMarkRead(item)}
          />
        ))}
      </div>
      <div
        className="flex flex-col gap-1 border-t px-4 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <span>
          Showing {items.length} of {total} fetched notifications.
        </span>
        <span>
          Page {page} of {Math.max(1, pages)}
        </span>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  isPending,
  onMarkRead,
}: {
  item: NotificationCenterItem;
  isPending: boolean;
  onMarkRead: () => void;
}) {
  const readLabel = item.read ? 'Read' : 'Unread';
  const documentLabel = item.docTitle ?? item.docId;

  return (
    <div
      className={cn(
        'grid gap-3 px-4 py-4 transition md:grid-cols-[minmax(0,1fr)_auto]',
        !item.read && 'bg-[var(--color-primary-light)]/30',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              SEVERITY_STYLES[item.severity],
            )}
          >
            <Circle className="h-2 w-2 fill-current" />
            {item.severity}
          </span>
          <span className="rounded-full border border-[var(--border-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {item.groupLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {item.read ? (
              <CircleCheck className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3 fill-current text-[var(--color-primary)]" />
            )}
            {readLabel}
          </span>
        </div>

        <div className="mt-2">
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            {item.typeLabel}
          </p>
          <p className="mt-1 text-sm text-[var(--text-main)]">
            <span className="font-medium">{documentLabel}</span>
            <span className="text-[var(--text-muted)]"> - {item.description}</span>
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>{formatRelative(item.createdAt)}</span>
          <span>{formatDateTime(item.createdAt)}</span>
          {item.traceId ? (
            <span className="font-mono text-[var(--text-faint)]">
              trace {item.traceId}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {!item.read ? (
          <button
            type="button"
            onClick={onMarkRead}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <CheckCheck className="h-4 w-4" />
            Mark read
          </button>
        ) : null}
        <Link
          href={item.targetHref}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white transition"
        >
          {item.actionLabel}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
