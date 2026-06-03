'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bug,
  Download,
  Eye,
  ExternalLink,
  FileWarning,
  Lightbulb,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { truncateMiddle } from '@/lib/utils/format';
import { auditKeys } from '@/features/audit/audit.keys';
import {
  getSecuritySummary,
  queryAuditLog,
  queryAuditLogWindow,
  updateSecurityRecommendationWorkflow,
  verifyAuditChain,
} from '@/features/audit/audit.api';
import type {
  AuditLogEntry,
  SecurityRecommendationWorkflowRequest,
  SecurityRecommendationWorkflowStatus,
} from '@/features/audit/audit.types';
import {
  buildSecurityDashboardModel,
  buildAuditFilterQuery,
  type SecurityDashboardMetric,
} from '@/features/audit/security-dashboard';

const metricIcons: Record<SecurityDashboardMetric['key'], typeof ShieldX> = {
  deniedEvents: ShieldX,
  downloadDenied: Download,
  malwareBlocked: Bug,
  dlpDetections: FileWarning,
};

const AUTHORIZED_ACCESS_PAGE_SIZE = 100;
const recommendationWorkflowOptions: Array<{
  value: SecurityRecommendationWorkflowStatus;
  label: string;
}> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'RESOLVED', label: 'Resolved' },
];

type RecommendationWorkflowMutation = {
  id: string;
  payload: SecurityRecommendationWorkflowRequest;
};

export default function SecurityPage() {
  const { session } = useAuth();
  const hasAccess = canViewAudit(session);
  const queryClient = useQueryClient();
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [verifyChainError, setVerifyChainError] = useState<string | null>(null);
  const [pendingRecommendationId, setPendingRecommendationId] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const summaryQuery = useQuery({
    queryKey: auditKeys.securitySummary(),
    queryFn: getSecuritySummary,
    enabled: hasAccess,
  });
  const deniedQuery = useQuery({
    queryKey: auditKeys.query({ result: 'DENY', page: 1, pageSize: 6 }),
    queryFn: () => queryAuditLog({ result: 'DENY' }, 1, 6),
    enabled: hasAccess,
  });
  const dlpQuery = useQuery({
    queryKey: auditKeys.query({ action: 'DLP_PATTERN_DETECTED', page: 1, pageSize: 3 }),
    queryFn: () => queryAuditLog({ action: 'DLP_PATTERN_DETECTED' }, 1, 3),
    enabled: hasAccess,
  });
  const downloadAuthorizedQuery = useQuery({
    queryKey: auditKeys.query({
      action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
      page: 1,
      pageSize: AUTHORIZED_ACCESS_PAGE_SIZE,
    }),
    queryFn: () =>
      queryAuditLogWindow(
        { action: 'DOCUMENT_DOWNLOAD_AUTHORIZED' },
        { pageSize: AUTHORIZED_ACCESS_PAGE_SIZE },
      ),
    enabled: hasAccess,
  });
  const previewAuthorizedQuery = useQuery({
    queryKey: auditKeys.query({
      action: 'DOCUMENT_PREVIEW_AUTHORIZED',
      page: 1,
      pageSize: AUTHORIZED_ACCESS_PAGE_SIZE,
    }),
    queryFn: () =>
      queryAuditLogWindow(
        { action: 'DOCUMENT_PREVIEW_AUTHORIZED' },
        { pageSize: AUTHORIZED_ACCESS_PAGE_SIZE },
      ),
    enabled: hasAccess,
  });

  const model = useMemo(
    () =>
      buildSecurityDashboardModel(summaryQuery.data, {
        downloadAuthorizedTotal: downloadAuthorizedQuery.data?.total ?? 0,
        sensitiveAccessEvents: [
          ...(downloadAuthorizedQuery.data?.data ?? []),
          ...(previewAuthorizedQuery.data?.data ?? []),
        ],
      }),
    [summaryQuery.data, downloadAuthorizedQuery.data, previewAuthorizedQuery.data],
  );
  const recentEvents = useMemo(
    () => mergeRecentEvents(deniedQuery.data?.data ?? [], dlpQuery.data?.data ?? []),
    [deniedQuery.data?.data, dlpQuery.data?.data],
  );
  const isSecurityFetching =
    summaryQuery.isFetching ||
    deniedQuery.isFetching ||
    dlpQuery.isFetching ||
    downloadAuthorizedQuery.isFetching ||
    previewAuthorizedQuery.isFetching;
  const isActivityLoading =
    downloadAuthorizedQuery.isLoading || previewAuthorizedQuery.isLoading;
  const isActivityError =
    downloadAuthorizedQuery.isError || previewAuthorizedQuery.isError;
  const workflowMutation = useMutation({
    mutationFn: ({ id, payload }: RecommendationWorkflowMutation) =>
      updateSecurityRecommendationWorkflow(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: auditKeys.securitySummary() }),
        queryClient.invalidateQueries({ queryKey: auditKeys.queries() }),
      ]);
    },
  });

  async function refreshSecurityData() {
    await Promise.all([
      summaryQuery.refetch(),
      deniedQuery.refetch(),
      dlpQuery.refetch(),
      downloadAuthorizedQuery.refetch(),
      previewAuthorizedQuery.refetch(),
    ]);
  }

  async function refreshAndVerifyChain() {
    setIsVerifyingChain(true);
    setVerifyChainError(null);
    try {
      await verifyAuditChain();
      await refreshSecurityData();
    } catch {
      setVerifyChainError('Audit chain verification failed.');
    } finally {
      setIsVerifyingChain(false);
    }
  }

  async function saveRecommendationWorkflow(
    id: string,
    payload: SecurityRecommendationWorkflowRequest,
  ) {
    if (pendingRecommendationId) {
      return;
    }

    setPendingRecommendationId(id);
    setWorkflowError(null);

    try {
      await workflowMutation.mutateAsync({ id, payload });
    } catch {
      setWorkflowError({
        id,
        message: 'Failed to update recommendation workflow.',
      });
    } finally {
      setPendingRecommendationId(null);
    }
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Compliance Officer or Admin role to view security posture."
      />
    );
  }

  if (summaryQuery.isLoading) {
    return <LoadingState label="Loading security posture..." />;
  }

  if (summaryQuery.isError) {
    return (
      <ErrorState
        message="Failed to load security summary."
        onRetry={summaryQuery.refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Operational posture for policy denies, malware, DLP, and audit-chain evidence."
        actions={
          <>
            <button
              type="button"
              onClick={refreshSecurityData}
              disabled={isSecurityFetching || isVerifyingChain}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isSecurityFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href={ROUTES.AUDIT}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
              style={{ background: 'var(--color-primary)' }}
            >
              Audit logs
              <ExternalLink className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <PosturePanel
          level={model.posture.level}
          label={model.posture.label}
          description={model.posture.description}
          checked={summaryQuery.data?.chain.checked ?? 0}
          onVerify={refreshAndVerifyChain}
          isVerifying={isVerifyingChain}
          verifyError={verifyChainError}
        />
        <QuickFilters filters={model.quickFilters} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {model.metrics.map((metric) => {
          const Icon = metricIcons[metric.key];
          return (
            <div
              key={metric.key}
              className="rounded-lg border p-4"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-muted)]">{metric.label}</p>
                <Icon className="h-4 w-4 text-[var(--text-faint)]" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                {metric.value}
              </p>
              <p className="mt-1 text-xs leading-snug text-[var(--text-faint)]">
                {metric.description}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <AlertsPanel alerts={model.alerts} />
        <RecentSecurityEvents
          events={recentEvents}
          isLoading={deniedQuery.isLoading || dlpQuery.isLoading}
          isError={deniedQuery.isError || dlpQuery.isError}
        />
      </section>

      <section className="mt-4">
        <RecommendationsPanel
          recommendations={model.recommendations}
          pendingRecommendationId={pendingRecommendationId}
          workflowError={workflowError}
          onSaveWorkflow={saveRecommendationWorkflow}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AccessActivityPanel
          activity={model.activity}
          isLoading={isActivityLoading}
          isError={isActivityError}
        />
        <RepeatedActorsPanel actors={model.repeatedDenyActors} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <RiskScoringPanel riskScoring={model.riskScoring} />
        <BehaviorAnomaliesPanel behaviorAnomalies={model.behaviorAnomalies} />
      </section>
    </div>
  );
}

function RecommendationsPanel({
  recommendations,
  pendingRecommendationId,
  workflowError,
  onSaveWorkflow,
}: {
  recommendations: ReturnType<typeof buildSecurityDashboardModel>['recommendations'];
  pendingRecommendationId: string | null;
  workflowError: { id: string; message: string } | null;
  onSaveWorkflow: (
    id: string,
    payload: SecurityRecommendationWorkflowRequest,
  ) => Promise<void>;
}) {
  const items = recommendations.items;

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--text-faint)]" />
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              Security recommendations
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Deterministic actions from audit-chain, DLP, malware, risk scoring,
            and behavior anomaly evidence.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded border border-[var(--border-soft)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
          No file content
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          No recommendation is raised by the current security summary.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const tone = getRecommendationTone(item.severity);
            return (
              <div
                key={item.id}
                className="rounded-lg border p-4"
                style={{
                  borderColor: tone.border,
                  background: tone.bg,
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ color: tone.text, background: tone.badgeBg }}
                      >
                        {item.severityLabel}
                      </span>
                      <span className="rounded bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                        {item.typeLabel}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {item.reason}
                    </p>
                  </div>
                  <Link
                    href={buildRecommendationAuditHref(item.auditFilters)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    Open audit
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                      Recommended action
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {item.recommendedAction}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                      Evidence
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {item.evidence.join(' · ')}
                    </p>
                  </div>
                </div>

                {item.affectedDocumentIds.length || item.affectedActorIds.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-faint)]">
                    {item.affectedDocumentIds.map((docId) => (
                      <span
                        key={docId}
                        className="rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1 font-mono"
                      >
                        doc {truncateMiddle(docId, 18)}
                      </span>
                    ))}
                    {item.affectedActorIds.map((actorId) => (
                      <span
                        key={actorId}
                        className="rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1 font-mono"
                      >
                        actor {truncateMiddle(actorId, 18)}
                      </span>
                    ))}
                  </div>
                ) : null}

                <RecommendationWorkflowControls
                  item={item}
                  isPending={pendingRecommendationId === item.id}
                  isDisabled={pendingRecommendationId !== null}
                  error={workflowError?.id === item.id ? workflowError.message : null}
                  onSave={onSaveWorkflow}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecommendationWorkflowControls({
  item,
  isPending,
  isDisabled,
  error,
  onSave,
}: {
  item: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number];
  isPending: boolean;
  isDisabled: boolean;
  error: string | null;
  onSave: (
    id: string,
    payload: SecurityRecommendationWorkflowRequest,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<SecurityRecommendationWorkflowStatus>(
    item.workflow.status,
  );
  const [note, setNote] = useState(item.workflow.note ?? '');

  useEffect(() => {
    setStatus(item.workflow.status);
    setNote(item.workflow.note ?? '');
  }, [item.id, item.workflow.note, item.workflow.status]);

  const trimmedNote = note.trim();
  const savedNote = (item.workflow.note ?? '').trim();
  const hasChanges = status !== item.workflow.status || trimmedNote !== savedNote;

  async function submitWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges || isDisabled) {
      return;
    }

    await onSave(item.id, {
      status,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    });
  }

  return (
    <form
      onSubmit={submitWorkflow}
      className="mt-3 border-t border-[var(--border-soft)] pt-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
            Workflow
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Current status:{' '}
            <span className="font-semibold text-[var(--text-main)]">
              {getRecommendationWorkflowLabel(item.workflow.status)}
            </span>
          </p>
          {item.workflow.updatedAt || item.workflow.updatedBy ? (
            <p className="mt-1 text-[11px] text-[var(--text-faint)]">
              {item.workflow.updatedAt
                ? `Updated ${formatDateTime(item.workflow.updatedAt)}`
                : 'Updated'}{' '}
              {item.workflow.updatedBy
                ? `by ${truncateMiddle(item.workflow.updatedBy, 18)}`
                : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.6fr)_auto] md:items-end">
        <label className="block text-xs font-medium text-[var(--text-main)]">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as SecurityRecommendationWorkflowStatus)
            }
            disabled={isDisabled}
            className="mt-1 h-9 w-full rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {recommendationWorkflowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-[var(--text-main)]">
          Note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isDisabled}
            maxLength={500}
            rows={2}
            placeholder="Add review note"
            className="mt-1 min-h-[2.25rem] w-full resize-y rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={isDisabled || !hasChanges}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? 'Saving' : 'Save'}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs font-medium text-[var(--state-error-text)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function PosturePanel({
  level,
  label,
  description,
  checked,
  onVerify,
  isVerifying,
  verifyError,
}: {
  level: 'healthy' | 'warning' | 'critical';
  label: string;
  description: string;
  checked: number;
  onVerify: () => void;
  isVerifying: boolean;
  verifyError: string | null;
}) {
  const Icon = level === 'critical' ? ShieldAlert : level === 'warning' ? AlertTriangle : ShieldCheck;
  const tone =
    level === 'critical'
      ? {
          bg: 'var(--state-error-bg)',
          border: 'var(--state-error-border)',
          text: 'var(--state-error-text)',
        }
      : level === 'warning'
        ? {
            bg: 'var(--status-pending-bg)',
            border: 'var(--status-pending-border)',
            text: 'var(--status-pending-text)',
          }
        : {
            bg: 'var(--status-published-bg)',
            border: 'var(--status-published-border)',
            text: 'var(--status-published-text)',
          };

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
            style={{
              background: tone.bg,
              borderColor: tone.border,
              color: tone.text,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--text-faint)]">
              Security posture
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
              {label}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              Audit chain evidence: {checked} event{checked === 1 ? '' : 's'} checked.
            </p>
            {verifyError ? (
              <p className="mt-2 text-xs font-medium text-[var(--state-error-text)]">
                {verifyError}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onVerify}
          disabled={isVerifying}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} />
          Verify chain
        </button>
      </div>
    </div>
  );
}

function QuickFilters({
  filters,
}: {
  filters: ReturnType<typeof buildSecurityDashboardModel>['quickFilters'];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">Quick investigations</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {filters.map((item) => (
          <Link
            key={item.label}
            href={`${ROUTES.AUDIT}?${buildAuditFilterQuery(item.filters)}`}
            className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-left transition hover:bg-[var(--bg-subtle)]"
          >
            <span className="block text-xs font-semibold text-[var(--text-main)]">
              {item.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-faint)]">
              {item.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({
  alerts,
}: {
  alerts: ReturnType<typeof buildSecurityDashboardModel>['alerts'];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">Security alerts</p>
      {alerts.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No elevated alert from the current audit summary.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.title}
              className="rounded-lg border p-3"
              style={{
                borderColor:
                  alert.severity === 'critical'
                    ? 'var(--state-error-border)'
                    : 'var(--status-pending-border)',
                background:
                  alert.severity === 'critical'
                    ? 'var(--state-error-bg)'
                    : 'var(--status-pending-bg)',
              }}
            >
              <p className="text-sm font-semibold text-[var(--text-strong)]">{alert.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {alert.description}
              </p>
              <p className="mt-2 text-xs font-medium text-[var(--text-main)]">
                {alert.action}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccessActivityPanel({
  activity,
  isLoading,
  isError,
}: {
  activity: ReturnType<typeof buildSecurityDashboardModel>['activity'];
  isLoading: boolean;
  isError: boolean;
}) {
  const sensitiveEvents = activity.sensitiveAccessEvents.slice(0, 5);

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">
        Authorized content access
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--text-faint)]">
            <Download className="h-4 w-4" />
            Download grants
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
            {isLoading ? '...' : activity.downloadAuthorizedTotal}
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">
            Successful file-content download authorizations in the audit window.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--text-faint)]">
            <Eye className="h-4 w-4" />
            Sensitive grants
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
            {isLoading ? '...' : activity.sensitiveAccessCount}
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">
            CONFIDENTIAL or SECRET preview/download grants for review.
          </p>
        </div>
      </div>

      {isError ? (
        <p className="mt-4 text-sm text-[var(--state-error-text)]">
          Failed to load authorized access events.
        </p>
      ) : null}
      {!isLoading && !isError && sensitiveEvents.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          No recent sensitive preview or download grants returned by audit query.
        </p>
      ) : null}
      {!isLoading && !isError && sensitiveEvents.length > 0 ? (
        <div className="mt-4 divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {sensitiveEvents.map((event) => (
            <div key={event.eventId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-[var(--text-main)]">
                  {event.action}
                </p>
                <span className="rounded bg-[var(--status-pending-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-pending-text)]">
                  {getClassificationLabel(event)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {formatDateTime(event.timestamp)} · actor {truncateMiddle(event.actorId, 16)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                {event.resourceId
                  ? `Document ${truncateMiddle(event.resourceId, 20)}`
                  : event.resourceType}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecentSecurityEvents({
  events,
  isLoading,
  isError,
}: {
  events: AuditLogEntry[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">Recent security events</p>
      {isLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">Loading events...</p>}
      {isError && <p className="mt-3 text-sm text-[var(--state-error-text)]">Failed to load recent events.</p>}
      {!isLoading && !isError && events.length === 0 && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No recent DENY or DLP events returned by the audit query.
        </p>
      )}
      {!isLoading && !isError && events.length > 0 && (
        <div className="mt-3 divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {events.map((event) => (
            <div key={event.eventId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-[var(--text-main)]">
                  {event.action}
                </p>
                <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  {event.result}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {formatDateTime(event.timestamp)} · actor {truncateMiddle(event.actorId, 16)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                {event.reason ?? event.resourceType}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RepeatedActorsPanel({
  actors,
}: {
  actors: ReturnType<typeof buildSecurityDashboardModel>['repeatedDenyActors'];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">Repeated deny actors</p>
      {actors.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No actor crossed the repeated-deny threshold.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {actors.map((actor) => (
            <div
              key={actor.actorId}
              className="rounded-lg border border-[var(--border-soft)] p-3"
            >
              <p className="font-mono text-xs text-[var(--text-main)]">
                {truncateMiddle(actor.actorId, 22)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {actor.denyCount} denied request{actor.denyCount === 1 ? '' : 's'} · {actor.riskLabel}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskScoringPanel({
  riskScoring,
}: {
  riskScoring: ReturnType<typeof buildSecurityDashboardModel>['riskScoring'];
}) {
  const documents = riskScoring.riskyDocuments;

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Document risk scoring
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Deterministic score from classification, authorized access volume,
            actor spread, and download grants.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded border border-[var(--border-soft)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
          Audit metadata only
        </span>
      </div>

      {documents.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          No elevated document access risk returned by the audit summary.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {documents.map((document) => {
            const tone = getRiskTone(document.riskBand);
            return (
              <div
                key={document.documentId}
                className="rounded-lg border p-4"
                style={{
                  borderColor: tone.border,
                  background: tone.bg,
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ color: tone.text, background: tone.badgeBg }}
                      >
                        {document.riskLabel}
                      </span>
                      <span className="rounded bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                        {document.classification}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-sm text-[var(--text-strong)]">
                      {truncateMiddle(document.documentId, 34)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {document.accessCount} access grant{document.accessCount === 1 ? '' : 's'} ·{' '}
                      {document.actorCount} actor{document.actorCount === 1 ? '' : 's'} · latest{' '}
                      {formatDateTime(document.latestAccessAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-2xl font-semibold text-[var(--text-strong)]">
                      {document.riskScore}
                    </p>
                    <p className="text-[11px] uppercase text-[var(--text-faint)]">
                      risk score
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                      Reasons
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {document.reasons.join(' · ')}
                    </p>
                  </div>
                  <Link
                    href={`${ROUTES.AUDIT}?${buildAuditFilterQuery(document.auditFilters)}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    Open audit
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BehaviorAnomaliesPanel({
  behaviorAnomalies,
}: {
  behaviorAnomalies: ReturnType<typeof buildSecurityDashboardModel>['behaviorAnomalies'];
}) {
  const signals = behaviorAnomalies.signals;

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Behavior anomalies
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Ransomware-oriented signals from actor activity, denied access,
            document spread, and destructive audit events.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded border border-[var(--border-soft)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
          Audit metadata only
        </span>
      </div>

      {signals.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          No actor crossed the behavior anomaly thresholds.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {signals.map((signal) => {
            const tone = getRiskTone(signal.riskBand);
            return (
              <div
                key={signal.signalId}
                className="rounded-lg border p-4"
                style={{
                  borderColor: tone.border,
                  background: tone.bg,
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ color: tone.text, background: tone.badgeBg }}
                      >
                        {signal.riskLabel}
                      </span>
                      <span className="rounded bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                        {signal.typeLabel}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-sm text-[var(--text-strong)]">
                      {truncateMiddle(signal.actorId, 34)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {signal.actionCount} event{signal.actionCount === 1 ? '' : 's'} ·{' '}
                      {signal.documentCount} document{signal.documentCount === 1 ? '' : 's'} ·{' '}
                      {formatDateTime(signal.windowStartedAt)} - {formatDateTime(signal.windowEndedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-2xl font-semibold text-[var(--text-strong)]">
                      {signal.riskScore}
                    </p>
                    <p className="text-[11px] uppercase text-[var(--text-faint)]">
                      anomaly score
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                      Reasons
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {signal.reasons.join(' · ')}
                    </p>
                  </div>
                  <Link
                    href={`${ROUTES.AUDIT}?${buildAuditFilterQuery(signal.auditFilters)}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    Open audit
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function mergeRecentEvents(...groups: AuditLogEntry[][]): AuditLogEntry[] {
  return groups
    .flat()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);
}

function getClassificationLabel(event: AuditLogEntry): string {
  return String(event.metadata?.classification ?? 'UNKNOWN').toUpperCase();
}

function getRiskTone(riskBand: 'critical' | 'warning' | 'watch') {
  if (riskBand === 'critical') {
    return {
      bg: 'var(--state-error-bg)',
      border: 'var(--state-error-border)',
      text: 'var(--state-error-text)',
      badgeBg: 'var(--bg-card)',
    };
  }

  if (riskBand === 'warning') {
    return {
      bg: 'var(--status-pending-bg)',
      border: 'var(--status-pending-border)',
      text: 'var(--status-pending-text)',
      badgeBg: 'var(--bg-card)',
    };
  }

  return {
    bg: 'var(--bg-card)',
    border: 'var(--border-soft)',
    text: 'var(--text-muted)',
    badgeBg: 'var(--bg-subtle)',
  };
}

function getRecommendationTone(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') {
    return {
      bg: 'var(--state-error-bg)',
      border: 'var(--state-error-border)',
      text: 'var(--state-error-text)',
      badgeBg: 'var(--bg-card)',
    };
  }

  if (severity === 'warning') {
    return {
      bg: 'var(--status-pending-bg)',
      border: 'var(--status-pending-border)',
      text: 'var(--status-pending-text)',
      badgeBg: 'var(--bg-card)',
    };
  }

  return {
    bg: 'var(--bg-card)',
    border: 'var(--border-soft)',
    text: 'var(--text-muted)',
    badgeBg: 'var(--bg-subtle)',
  };
}

function getRecommendationWorkflowLabel(
  status: SecurityRecommendationWorkflowStatus,
): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'INVESTIGATING':
      return 'Investigating';
    case 'REVIEWED':
      return 'Reviewed';
    case 'RESOLVED':
      return 'Resolved';
  }
}

function buildRecommendationAuditHref(
  filters: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number]['auditFilters'],
): string {
  const query = buildAuditFilterQuery(filters);
  return query ? `${ROUTES.AUDIT}?${query}` : ROUTES.AUDIT;
}
