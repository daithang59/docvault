'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Circle,
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
import {
  MetricTile,
  PriorityBarList,
  ScoreGauge,
  SegmentDonut,
} from '@/components/analytics/analytics-primitives';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { truncateMiddle } from '@/lib/utils/format';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { auditKeys } from '@/features/audit/audit.keys';
import {
  getSecurityRecommendationWorkflowHistory,
  getSecuritySummary,
  queryAuditLog,
  queryAuditLogWindow,
  updateSecurityRecommendationWorkflow,
  verifyAuditChain,
} from '@/features/audit/audit.api';
import type {
  AuditChainStatus,
  AuditLogEntry,
  SecurityRecommendationWorkflowHistoryEntry,
  SecurityRecommendationWorkflowRequest,
  SecurityRecommendationWorkflowStatus,
} from '@/features/audit/audit.types';
import {
  buildSecurityDashboardModel,
  buildAuditFilterQuery,
  buildRecommendationEvidencePacket,
  buildSecurityCaseWorkflowNote,
  filterSecurityRecommendationRows,
  getSecurityRecommendationQueueCounts,
  getSecurityRouteCounts,
  SECURITY_RECOMMENDATION_PREVIEW_LIMIT,
  validateSecurityCaseWorkflowDraft,
  type SecurityAlertRoute,
  type SecurityAlertRouting,
  type SecurityCaseResolutionKind,
  type SecurityDashboardMetric,
  type SecurityRecommendationPlaybook,
  type SecurityRecommendationQueueView,
  type SecurityRecommendationSlaState,
} from '@/features/audit/security-dashboard';

const metricIcons: Record<SecurityDashboardMetric['key'], typeof ShieldX> = {
  deniedEvents: ShieldX,
  downloadDenied: Download,
  malwareBlocked: Bug,
  dlpDetections: FileWarning,
};

type ActorNameMap = Record<string, { displayName: string; username: string }>;

// Resolved actor display names, provided once at the page level so every panel
// can swap opaque keycloak ids for human names without re-fetching.
const ActorNamesContext = createContext<ActorNameMap>({});

function useActorNames(): ActorNameMap {
  return useContext(ActorNamesContext);
}

function resolveActorName(id: string, names: ActorNameMap, fallbackLength: number): string {
  const displayName = names[id]?.displayName;
  // Keep a truncated id when the directory can't resolve the actor — it stays
  // correlatable for investigation, which "Unknown User" would lose.
  if (displayName && displayName !== 'Unknown User') return displayName;
  return truncateMiddle(id, fallbackLength);
}

function ActorLabel({ id, length = 18 }: { id: string; length?: number }) {
  const names = useActorNames();
  return <>{resolveActorName(id, names, length)}</>;
}

// Server-built titles/reasons embed full actor ids (e.g. "...access by <uuid>").
// Swap each known id for its display name so the prose reads naturally.
function humanizeActorText(text: string, names: ActorNameMap): string {
  let result = text;
  for (const [id, info] of Object.entries(names)) {
    if (info.displayName && info.displayName !== 'Unknown User' && result.includes(id)) {
      result = result.split(id).join(info.displayName);
    }
  }
  return result;
}

const AUTHORIZED_ACCESS_PAGE_SIZE = 100;
const SECURITY_ACCESS_ACTIVITY_PREVIEW_LIMIT = 5;
const SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT = 4;
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

type RecommendationHistoryState = Record<
  string,
  SecurityRecommendationWorkflowHistoryEntry[]
>;
type RecommendationHistoryErrors = Record<string, string | undefined>;

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
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);
  const [workflowHistoryByRecommendationId, setWorkflowHistoryByRecommendationId] =
    useState<RecommendationHistoryState>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyErrors, setHistoryErrors] = useState<RecommendationHistoryErrors>({});
  const [recommendationQueueView, setRecommendationQueueView] =
    useState<SecurityRecommendationQueueView>('active');
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [selectedRecommendationId, setSelectedRecommendationId] =
    useState<string | null>(null);

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
  // Gather every actor id surfaced across the dashboard so we can resolve all
  // display names in a single batched request shared by the panels below.
  const actorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const actor of model.repeatedDenyActors) ids.add(actor.actorId);
    for (const signal of model.behaviorAnomalies.signals) ids.add(signal.actorId);
    for (const item of model.recommendations.items) {
      for (const actorId of item.affectedActorIds) ids.add(actorId);
      if (item.workflow.updatedBy) ids.add(item.workflow.updatedBy);
    }
    for (const event of recentEvents) if (event.actorId) ids.add(event.actorId);
    for (const event of model.activity.sensitiveAccessEvents) {
      if (event.actorId) ids.add(event.actorId);
    }
    return [...ids];
  }, [model, recentEvents]);
  const { data: actorNames } = useOwnerDisplayNames(actorIds);
  const actorNameMap = useMemo<ActorNameMap>(() => actorNames ?? {}, [actorNames]);
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
      setWorkflowHistoryByRecommendationId((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch {
      setWorkflowError({
        id,
        message: 'Failed to update recommendation workflow.',
      });
    } finally {
      setPendingRecommendationId(null);
    }
  }

  async function loadRecommendationHistory(id: string) {
    setHistoryLoadingId(id);
    setHistoryErrors((current) => ({ ...current, [id]: undefined }));

    try {
      const history = await getSecurityRecommendationWorkflowHistory(id);
      setWorkflowHistoryByRecommendationId((current) => ({
        ...current,
        [id]: history,
      }));
      return history;
    } catch {
      setHistoryErrors((current) => ({
        ...current,
        [id]: 'Failed to load workflow history.',
      }));
      return null;
    } finally {
      setHistoryLoadingId(null);
    }
  }

  async function toggleRecommendationHistory(id: string) {
    const isExpanded = expandedHistoryIds.includes(id);
    setExpandedHistoryIds((current) =>
      isExpanded ? current.filter((item) => item !== id) : [...current, id],
    );

    if (!isExpanded && !workflowHistoryByRecommendationId[id]) {
      await loadRecommendationHistory(id);
    }
  }

  async function downloadRecommendationEvidence(
    item: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number],
  ) {
    const history =
      workflowHistoryByRecommendationId[item.id] ??
      (await loadRecommendationHistory(item.id));

    if (!history || !summaryQuery.data?.chain) {
      return;
    }

    const packet = buildRecommendationEvidencePacket({
      recommendation: item,
      auditChain: summaryQuery.data.chain,
      workflowHistory: history,
      generatedAt: new Date().toISOString(),
    });
    const blob = new Blob([JSON.stringify(packet, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.id.replace(/[^a-z0-9-]+/gi, '-')}-evidence-packet.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  const auditChain = summaryQuery.data?.chain ?? { valid: false, checked: 0 };
  const routeCounts = getSecurityRouteCounts(
    model.alerts,
    model.recommendations.items,
  );

  return (
    <ActorNamesContext.Provider value={actorNameMap}>
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
        <ScoreGauge
          className="min-h-[180px]"
          description={model.commandCenter.postureGauge.description}
          href={model.commandCenter.postureGauge.href}
          label={model.commandCenter.postureGauge.label}
          tone={model.commandCenter.postureGauge.tone}
          value={model.commandCenter.postureGauge.value}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {model.metrics.map((metric) => {
            const Icon = metricIcons[metric.key];
            return (
              <MetricTile
                key={metric.key}
                description={metric.description}
                href={buildMetricAuditHref(metric.key)}
                icon={<Icon className="h-5 w-5" />}
                label={metric.label}
                tone={metric.value > 0 ? 'warning' : 'success'}
                value={metric.value}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SegmentDonut
          label="Alert distribution"
          segments={model.commandCenter.alertSegments}
        />
        <PriorityBarList
          label="Document risk bands"
          segments={model.commandCenter.riskBandSegments}
        />
        <PriorityBarList
          label="Behavior anomaly bands"
          segments={model.commandCenter.anomalyBandSegments}
        />
        <PriorityBarList
          label="Recommendation SLA"
          segments={model.commandCenter.recommendationSlaSegments}
        />
      </section>

      <AlertRoutingSummary counts={routeCounts} />

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <PosturePanel
          level={model.posture.level}
          label={model.posture.label}
          description={model.posture.description}
          checked={auditChain.checked}
          onVerify={refreshAndVerifyChain}
          isVerifying={isVerifyingChain}
          verifyError={verifyChainError}
        />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <PriorityBarList
            label="Content access signals"
            segments={model.commandCenter.accessSegments}
          />
          <QuickFilters filters={model.quickFilters} />
        </div>
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
          auditChain={auditChain}
          queueView={recommendationQueueView}
          showAll={showAllRecommendations}
          onQueueViewChange={(view) => {
            setRecommendationQueueView(view);
            setShowAllRecommendations(false);
            setSelectedRecommendationId(null);
          }}
          onToggleShowAll={() =>
            setShowAllRecommendations((current) => !current)
          }
          selectedRecommendationId={selectedRecommendationId}
          onSelectRecommendation={setSelectedRecommendationId}
          pendingRecommendationId={pendingRecommendationId}
          workflowError={workflowError}
          expandedHistoryIds={expandedHistoryIds}
          workflowHistoryByRecommendationId={workflowHistoryByRecommendationId}
          historyLoadingId={historyLoadingId}
          historyErrors={historyErrors}
          onSaveWorkflow={saveRecommendationWorkflow}
          onToggleHistory={toggleRecommendationHistory}
          onDownloadEvidence={downloadRecommendationEvidence}
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
    </ActorNamesContext.Provider>
  );
}

function AlertRoutingSummary({
  counts,
}: {
  counts: Record<SecurityAlertRoute, number>;
}) {
  const routes: SecurityAlertRoute[] = ['CASE', 'REVIEW', 'SIGNAL'];

  return (
    <section className="mt-4 grid gap-3 md:grid-cols-3">
      {routes.map((route) => {
        const tone = getSecurityRouteTone(route);

        return (
          <div
            key={route}
            className={`rounded-lg border px-4 py-3 ${tone.container}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-[var(--text-faint)]">
                {getSecurityRouteShortLabel(route)}
              </p>
              <SecurityRouteBadge
                routing={{
                  route,
                  routeLabel: getSecurityRouteBadgeLabel(route),
                }}
              />
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
              {counts[route]}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {getSecurityRouteDescription(route)}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function RecommendationsPanel({
  recommendations,
  auditChain,
  queueView,
  showAll,
  onQueueViewChange,
  onToggleShowAll,
  selectedRecommendationId,
  onSelectRecommendation,
  pendingRecommendationId,
  workflowError,
  expandedHistoryIds,
  workflowHistoryByRecommendationId,
  historyLoadingId,
  historyErrors,
  onSaveWorkflow,
  onToggleHistory,
  onDownloadEvidence,
}: {
  recommendations: ReturnType<typeof buildSecurityDashboardModel>['recommendations'];
  auditChain: AuditChainStatus;
  queueView: SecurityRecommendationQueueView;
  showAll: boolean;
  onQueueViewChange: (view: SecurityRecommendationQueueView) => void;
  onToggleShowAll: () => void;
  selectedRecommendationId: string | null;
  onSelectRecommendation: (id: string | null) => void;
  pendingRecommendationId: string | null;
  workflowError: { id: string; message: string } | null;
  expandedHistoryIds: string[];
  workflowHistoryByRecommendationId: RecommendationHistoryState;
  historyLoadingId: string | null;
  historyErrors: RecommendationHistoryErrors;
  onSaveWorkflow: (
    id: string,
    payload: SecurityRecommendationWorkflowRequest,
  ) => Promise<void>;
  onToggleHistory: (id: string) => Promise<void>;
  onDownloadEvidence: (
    item: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number],
  ) => Promise<void>;
}) {
  const counts = getSecurityRecommendationQueueCounts(recommendations.items);
  const filteredItems = filterSecurityRecommendationRows(
    recommendations.items,
    queueView,
  );
  const hiddenCount = Math.max(
    0,
    filteredItems.length - SECURITY_RECOMMENDATION_PREVIEW_LIMIT,
  );
  const items = showAll
    ? filteredItems
    : filteredItems.slice(0, SECURITY_RECOMMENDATION_PREVIEW_LIMIT);
  const actorNames = useActorNames();

  return (
    <div
      id="security-recommendations"
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
              Evidence-backed findings
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Security warnings grouped by risk category with affected scope,
            rationale, next action, and metadata-only evidence.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded border border-[var(--border-soft)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
          No file content
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-1">
          {(['active', 'resolved', 'all'] as SecurityRecommendationQueueView[]).map(
            (view) => (
              <button
                key={view}
                type="button"
                aria-pressed={queueView === view}
                onClick={() => onQueueViewChange(view)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  queueView === view
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {getRecommendationQueueViewLabel(view)} {counts[view]}
              </button>
            ),
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Active hides resolved recommendations without deleting audit evidence.
        </p>
      </div>

      {filteredItems.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          {queueView === 'active'
            ? 'No active recommendations need review.'
            : queueView === 'resolved'
              ? 'No resolved recommendations are available.'
              : 'No recommendation is raised by the current security summary.'}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {items.map((item) => {
              const tone = getRecommendationTone(item.severity);
              const isSelected = selectedRecommendationId === item.id;
              const isCase = item.finding.routing.route === 'CASE';
              const primaryActionLabel = isSelected
                ? 'Hide details'
                : isCase
                  ? item.workflow.status === 'OPEN'
                    ? 'Start case'
                    : 'Continue case'
                  : 'Review finding';

              return (
                <div
                  key={item.id}
                  className="rounded-lg border px-4 py-3"
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
                        <SecurityRouteBadge routing={item.finding.routing} />
                        <span className="rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-main)]">
                          {item.finding.categoryLabel}
                        </span>
                        <span className="rounded bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                          {item.typeLabel}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                        {humanizeActorText(item.title, actorNames)}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        {item.finding.summary}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectRecommendation(isSelected ? null : item.id)
                        }
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-white transition hover:brightness-110"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        {primaryActionLabel}
                      </button>
                      <Link
                        href={buildRecommendationAuditHref(item.auditFilters)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                      >
                        Open audit
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                        Affected scope
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        {item.finding.affectedScopeLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                        Evidence
                      </p>
                      <p className="mt-1 max-h-10 overflow-hidden text-xs leading-relaxed text-[var(--text-muted)]">
                        {item.evidence.join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <span className="inline-flex h-7 items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-main)]">
                        {getRecommendationWorkflowLabel(item.workflow.status)}
                      </span>
                      <span
                        className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${getRecommendationSlaTone(
                          item.playbook.slaState,
                        )}`}
                      >
                        {getRecommendationSlaLabel(item.playbook.slaState)}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
                      <p className="text-xs leading-relaxed text-[var(--text-faint)]">
                        {item.finding.routing.routeDescription}
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                            {item.finding.evidenceQuestion}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                            {humanizeActorText(item.reason, actorNames)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
                            Next action
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                            <span className="font-medium text-[var(--text-main)]">
                              {item.finding.nextStepLabel}
                            </span>
                            {': '}
                            {humanizeActorText(item.recommendedAction, actorNames)}
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
                              actor <ActorLabel id={actorId} length={18} />
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <RecommendationWorkflowControls
                        key={`${item.id}:${item.workflow.status}:${item.workflow.note ?? ''}`}
                        item={item}
                        isPending={pendingRecommendationId === item.id}
                        isDisabled={pendingRecommendationId !== null}
                        error={workflowError?.id === item.id ? workflowError.message : null}
                        onSave={onSaveWorkflow}
                      />

                      <RecommendationPlaybook playbook={item.playbook} />

                      <RecommendationHistoryControls
                        item={item}
                        auditChain={auditChain}
                        isExpanded={expandedHistoryIds.includes(item.id)}
                        isLoading={historyLoadingId === item.id}
                        error={historyErrors[item.id] ?? null}
                        history={workflowHistoryByRecommendationId[item.id] ?? []}
                        onToggleHistory={onToggleHistory}
                        onDownloadEvidence={onDownloadEvidence}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {filteredItems.length > SECURITY_RECOMMENDATION_PREVIEW_LIMIT ? (
            <ShowMoreListToggle
              hiddenCount={hiddenCount}
              showAll={showAll}
              onToggle={onToggleShowAll}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ShowMoreListToggle({
  hiddenCount,
  showAll,
  onToggle,
}: {
  hiddenCount: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
      >
        {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
      </button>
    </div>
  );
}

function RecommendationPlaybook({
  playbook,
}: {
  playbook: SecurityRecommendationPlaybook;
}) {
  const tone = getRecommendationSlaTone(playbook.slaState);

  return (
    <div className="mt-3 rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
            Playbook
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-main)]">
            {playbook.ownerLabel}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          <Clock className="h-3.5 w-3.5" />
          {getRecommendationSlaLabel(playbook.slaState)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
        <p>
          SLA target: <span className="font-medium">{playbook.slaHours}h</span>
        </p>
        <p>
          Due:{' '}
          <span className="font-medium">
            {playbook.dueAt
              ? formatDateTime(playbook.dueAt)
              : 'starts after investigation'}
          </span>
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {playbook.steps.map((step) => {
          const Icon = step.isComplete ? CheckCircle2 : Circle;

          return (
            <div key={step.id} className="flex gap-2">
              <Icon
                className={`mt-0.5 h-4 w-4 flex-none ${
                  step.isComplete
                    ? 'text-[var(--status-published-text)]'
                    : 'text-[var(--text-faint)]'
                }`}
              />
              <div>
                <p className="text-xs font-medium text-[var(--text-main)]">
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
                  {step.evidenceHint}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationHistoryControls({
  item,
  auditChain,
  isExpanded,
  isLoading,
  error,
  history,
  onToggleHistory,
  onDownloadEvidence,
}: {
  item: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number];
  auditChain: AuditChainStatus;
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;
  history: SecurityRecommendationWorkflowHistoryEntry[];
  onToggleHistory: (id: string) => Promise<void>;
  onDownloadEvidence: (
    item: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number],
  ) => Promise<void>;
}) {
  return (
    <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
            Evidence packet
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Audit chain: {auditChain.checked} event{auditChain.checked === 1 ? '' : 's'} checked
            {auditChain.valid ? '' : ' · invalid'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onToggleHistory(item.id)}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Clock className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isExpanded ? 'Hide history' : 'History'}
          </button>
          <button
            type="button"
            onClick={() => onDownloadEvidence(item)}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Download packet
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs font-medium text-[var(--state-error-text)]">
          {error}
        </p>
      ) : null}

      {isExpanded ? (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading history...</p>
          ) : null}
          {!isLoading && history.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No workflow update has been recorded yet.
            </p>
          ) : null}
          {!isLoading &&
            history.map((entry) => (
              <div
                key={entry.eventId}
                className="rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-main)]">
                    {getRecommendationWorkflowLabel(entry.status)}
                  </span>
                  <span className="text-[11px] text-[var(--text-faint)]">
                    {formatDateTime(entry.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  actor <ActorLabel id={entry.updatedBy} length={18} /> · event{' '}
                  {truncateMiddle(entry.eventId, 18)}
                </p>
                {entry.note ? (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {entry.note}
                  </p>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
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
  if (item.finding.routing.route === 'CASE') {
    return (
      <RecommendationCaseWorkflowControls
        item={item}
        isPending={isPending}
        isDisabled={isDisabled}
        error={error}
        onSave={onSave}
      />
    );
  }

  return (
    <RecommendationLightweightWorkflowControls
      item={item}
      isPending={isPending}
      isDisabled={isDisabled}
      error={error}
      onSave={onSave}
    />
  );
}

function RecommendationCaseWorkflowControls({
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
  const [investigationNote, setInvestigationNote] = useState('');
  const [resolutionKind, setResolutionKind] =
    useState<SecurityCaseResolutionKind | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);

  const draft = {
    investigationNote,
    resolutionKind,
    resolutionNote,
    verificationConfirmed,
  };
  const validation = validateSecurityCaseWorkflowDraft(draft);
  const note = buildSecurityCaseWorkflowNote(draft);
  const isResolved = item.workflow.status === 'RESOLVED';
  const controlsDisabled = isDisabled || isResolved;
  const canStart = item.workflow.status === 'OPEN' && !controlsDisabled;
  const canSaveReview =
    investigationNote.trim().length > 0 && !controlsDisabled;
  const canResolve = validation.canResolve && !controlsDisabled;

  async function startCase() {
    if (!canStart) return;

    await onSave(item.id, {
      status: 'INVESTIGATING',
      note: `Case workflow started: ${item.finding.categoryLabel}`,
    });
  }

  async function saveReviewEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveReview) return;

    await onSave(item.id, {
      status: 'REVIEWED',
      note,
    });
  }

  async function resolveCase() {
    if (!canResolve) return;

    await onSave(item.id, {
      status: 'RESOLVED',
      note,
    });
  }

  return (
    <form
      onSubmit={saveReviewEvidence}
      className="mt-3 border-t border-[var(--border-soft)] pt-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">
              Case workflow
            </p>
            <SecurityRouteBadge routing={item.finding.routing} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Current status:{' '}
            <span className="font-semibold text-[var(--text-main)]">
              {getRecommendationWorkflowLabel(item.workflow.status)}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Resolve is gated by investigation, remediation or accepted risk, and
            verification evidence.
          </p>
          {item.workflow.note ? (
            <p className="mt-2 rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
              Last note: {item.workflow.note}
            </p>
          ) : null}
        </div>
        {item.workflow.status === 'OPEN' ? (
          <button
            type="button"
            onClick={startCase}
            disabled={!canStart}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Clock className="h-4 w-4" />
            {isPending ? 'Starting' : 'Start case'}
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3">
        <label className="block text-xs font-medium text-[var(--text-main)]">
          Investigation
          <textarea
            value={investigationNote}
            onChange={(event) => setInvestigationNote(event.target.value)}
            disabled={controlsDisabled}
            maxLength={180}
            rows={2}
            placeholder="Summarize affected scope and why this case is real"
            className="mt-1 min-h-[3rem] w-full resize-y rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div>
          <p className="text-xs font-medium text-[var(--text-main)]">
            Decision
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['REMEDIATED', 'Remediated'],
                ['ACCEPTED_RISK', 'Accepted risk'],
              ] as Array<[SecurityCaseResolutionKind, string]>
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)]"
              >
                <input
                  type="radio"
                  name={`case-decision-${item.id}`}
                  value={value}
                  checked={resolutionKind === value}
                  onChange={() => setResolutionKind(value)}
                  disabled={controlsDisabled}
                  className="accent-[var(--color-primary)]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-xs font-medium text-[var(--text-main)]">
          Remediation or accepted-risk evidence
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            disabled={controlsDisabled}
            maxLength={180}
            rows={2}
            placeholder="Describe the fix, owner approval, expiry, or accepted-risk reason"
            className="mt-1 min-h-[3rem] w-full resize-y rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="flex items-start gap-2 rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={verificationConfirmed}
            onChange={(event) => setVerificationConfirmed(event.target.checked)}
            disabled={controlsDisabled}
            className="mt-0.5 accent-[var(--color-primary)]"
          />
          <span>
            Verification confirmed: audit scope reviewed, decision recorded, and
            evidence packet is ready for export.
          </span>
        </label>
      </div>

      {!isResolved && !validation.canResolve ? (
        <div className="mt-3 rounded border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--status-pending-text)]">
            Missing before resolve
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {validation.missingRequirements.join(' · ')}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-medium text-[var(--state-error-text)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSaveReview}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? 'Saving' : 'Save review evidence'}
        </button>
        <button
          type="button"
          onClick={resolveCase}
          disabled={!canResolve}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-3 text-sm font-medium text-[var(--state-error-text)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPending ? 'Resolving' : 'Resolve case'}
        </button>
      </div>
    </form>
  );
}

function RecommendationLightweightWorkflowControls({
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
              {item.workflow.updatedBy ? (
                <>
                  by <ActorLabel id={item.workflow.updatedBy} length={18} />
                </>
              ) : null}
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
              <div className="flex flex-wrap items-center gap-2">
                <SecurityRouteBadge routing={alert.routing} />
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  {alert.title}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {alert.description}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-faint)]">
                {alert.routing.routeDescription}
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
  const [showAll, setShowAll] = useState(false);
  const sensitiveAccessEvents = activity.sensitiveAccessEvents;
  const hiddenCount = Math.max(
    0,
    sensitiveAccessEvents.length - SECURITY_ACCESS_ACTIVITY_PREVIEW_LIMIT,
  );
  const sensitiveEvents = showAll
    ? sensitiveAccessEvents
    : sensitiveAccessEvents.slice(0, SECURITY_ACCESS_ACTIVITY_PREVIEW_LIMIT);

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
      {!isLoading && !isError && sensitiveAccessEvents.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          No recent sensitive preview or download grants returned by audit query.
        </p>
      ) : null}
      {!isLoading && !isError && sensitiveAccessEvents.length > 0 ? (
        <>
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
                  {formatDateTime(event.timestamp)} · actor <ActorLabel id={event.actorId} length={16} />
                </p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  {event.resourceId
                    ? `Document ${truncateMiddle(event.resourceId, 20)}`
                    : event.resourceType}
                </p>
              </div>
            ))}
          </div>
          {sensitiveAccessEvents.length > SECURITY_ACCESS_ACTIVITY_PREVIEW_LIMIT ? (
            <ShowMoreListToggle
              hiddenCount={hiddenCount}
              showAll={showAll}
              onToggle={() => setShowAll((current) => !current)}
            />
          ) : null}
        </>
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
                {formatDateTime(event.timestamp)} · actor <ActorLabel id={event.actorId} length={16} />
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
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = Math.max(
    0,
    actors.length - SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT,
  );
  const visibleActors = showAll
    ? actors
    : actors.slice(0, SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT);

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
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleActors.map((actor) => (
              <div
                key={actor.actorId}
                className="rounded-lg border border-[var(--border-soft)] p-3"
              >
                <p className="text-xs font-medium text-[var(--text-main)]">
                  <ActorLabel id={actor.actorId} length={22} />
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {actor.denyCount} denied request{actor.denyCount === 1 ? '' : 's'} · {actor.riskLabel}
                </p>
              </div>
            ))}
          </div>
          {actors.length > SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT ? (
            <ShowMoreListToggle
              hiddenCount={hiddenCount}
              showAll={showAll}
              onToggle={() => setShowAll((current) => !current)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function RiskScoringPanel({
  riskScoring,
}: {
  riskScoring: ReturnType<typeof buildSecurityDashboardModel>['riskScoring'];
}) {
  const [showAll, setShowAll] = useState(false);
  const documents = riskScoring.riskyDocuments;
  const hiddenCount = Math.max(
    0,
    documents.length - SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT,
  );
  const visibleDocuments = showAll
    ? documents
    : documents.slice(0, SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT);

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
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleDocuments.map((document) => {
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
          {documents.length > SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT ? (
            <ShowMoreListToggle
              hiddenCount={hiddenCount}
              showAll={showAll}
              onToggle={() => setShowAll((current) => !current)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function BehaviorAnomaliesPanel({
  behaviorAnomalies,
}: {
  behaviorAnomalies: ReturnType<typeof buildSecurityDashboardModel>['behaviorAnomalies'];
}) {
  const [showAll, setShowAll] = useState(false);
  const signals = behaviorAnomalies.signals;
  const hiddenCount = Math.max(
    0,
    signals.length - SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT,
  );
  const visibleSignals = showAll
    ? signals
    : signals.slice(0, SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT);

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
        <>
          <div className="mt-4 space-y-3">
            {visibleSignals.map((signal) => {
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
                      <p className="mt-2 text-sm font-medium text-[var(--text-strong)]">
                        <ActorLabel id={signal.actorId} length={34} />
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
          {signals.length > SECURITY_SUPPORTING_LIST_PREVIEW_LIMIT ? (
            <ShowMoreListToggle
              hiddenCount={hiddenCount}
              showAll={showAll}
              onToggle={() => setShowAll((current) => !current)}
            />
          ) : null}
        </>
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

function SecurityRouteBadge({
  routing,
}: {
  routing: Pick<SecurityAlertRouting, 'route' | 'routeLabel'>;
}) {
  const tone = getSecurityRouteTone(routing.route);

  return (
    <span
      className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${tone.badge}`}
    >
      {routing.routeLabel}
    </span>
  );
}

function getSecurityRouteTone(route: SecurityAlertRoute): {
  badge: string;
  container: string;
} {
  switch (route) {
    case 'CASE':
      return {
        badge:
          'border border-[var(--state-error-border)] bg-[var(--state-error-bg)] text-[var(--state-error-text)]',
        container:
          'border-[var(--state-error-border)] bg-[var(--state-error-bg)]',
      };
    case 'REVIEW':
      return {
        badge:
          'border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]',
        container:
          'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)]',
      };
    case 'SIGNAL':
      return {
        badge:
          'border border-[var(--state-info-border)] bg-[var(--state-info-bg)] text-[var(--state-info-text)]',
        container:
          'border-[var(--state-info-border)] bg-[var(--state-info-bg)]',
      };
  }
}

function getSecurityRouteBadgeLabel(route: SecurityAlertRoute): string {
  if (route === 'CASE') return 'Case workflow required';
  if (route === 'REVIEW') return 'Lightweight review';
  return 'Monitor signal';
}

function getSecurityRouteShortLabel(route: SecurityAlertRoute): string {
  if (route === 'CASE') return 'Cases';
  if (route === 'REVIEW') return 'Reviews';
  return 'Signals';
}

function getSecurityRouteDescription(route: SecurityAlertRoute): string {
  if (route === 'CASE') {
    return 'Needs owner, SLA, investigation, remediation or accepted risk, verification, and evidence.';
  }

  if (route === 'REVIEW') {
    return 'Needs human review, but full case workflow would be too heavy.';
  }

  return 'Track as a trend or monitoring signal without workflow overhead.';
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

function getRecommendationQueueViewLabel(
  view: SecurityRecommendationQueueView,
): string {
  switch (view) {
    case 'active':
      return 'Active';
    case 'resolved':
      return 'Resolved';
    case 'all':
      return 'All';
  }
}

function getRecommendationSlaLabel(state: SecurityRecommendationSlaState): string {
  switch (state) {
    case 'not-started':
      return 'Not started';
    case 'on-track':
      return 'On track';
    case 'due-soon':
      return 'Due soon';
    case 'overdue':
      return 'Overdue';
    case 'closed':
      return 'Closed';
  }
}

function getRecommendationSlaTone(state: SecurityRecommendationSlaState): string {
  switch (state) {
    case 'closed':
      return 'border-[var(--status-published-border)] bg-[var(--status-published-bg)] text-[var(--status-published-text)]';
    case 'overdue':
      return 'border-[var(--state-error-border)] bg-[var(--state-error-bg)] text-[var(--state-error-text)]';
    case 'due-soon':
      return 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]';
    case 'on-track':
      return 'border-[var(--state-info-border)] bg-[var(--state-info-bg)] text-[var(--state-info-text)]';
    case 'not-started':
      return 'border-[var(--border-soft)] bg-[var(--bg-subtle)] text-[var(--text-muted)]';
  }
}

function buildRecommendationAuditHref(
  filters: ReturnType<typeof buildSecurityDashboardModel>['recommendations']['items'][number]['auditFilters'],
): string {
  const query = buildAuditFilterQuery(filters);
  return query ? `${ROUTES.AUDIT}?${query}` : ROUTES.AUDIT;
}

function buildMetricAuditHref(key: SecurityDashboardMetric['key']): string {
  switch (key) {
    case 'deniedEvents':
      return `${ROUTES.AUDIT}?${buildAuditFilterQuery({ result: 'DENY' })}`;
    case 'downloadDenied':
      return `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'DOCUMENT_DOWNLOAD_DENIED' })}`;
    case 'malwareBlocked':
      return `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'MALWARE_UPLOAD_BLOCKED' })}`;
    case 'dlpDetections':
      return `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'DLP_PATTERN_DETECTED' })}`;
  }
}
