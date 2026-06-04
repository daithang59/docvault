'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { getSecurityRecommendationWorkflowHistory, getSecuritySummary } from '@/features/audit/audit.api';
import { auditKeys } from '@/features/audit/audit.keys';
import {
  buildRecommendationEvidencePacket,
  buildSecurityDashboardModel,
} from '@/features/audit/security-dashboard';
import { getComplianceEvidencePacket } from '@/features/documents/documents.api';
import {
  buildEvidenceBundle,
  buildEvidenceCaseNarrative,
  buildEvidenceCenterManifest,
  buildEvidenceCenterModel,
  buildEvidenceCenterDocumentPacket,
  type EvidenceBundleManifest,
  type EvidenceCaseNarrative,
  type EvidenceCenterModel,
  type EvidenceDocumentPacketTarget,
  type EvidenceRecommendationTarget,
  type EvidenceSourceState,
} from '@/features/evidence/evidence-center';
import { buildEvidenceReportHtml } from '@/features/evidence/evidence-report';
import { getRetentionEvidence } from '@/features/retention/retention.api';
import { retentionKeys } from '@/features/retention/retention.keys';
import { useAuth } from '@/lib/auth/auth-context';
import { canViewAudit } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';

const sourceStateTone: Record<EvidenceSourceState, string> = {
  ready:
    'border-[var(--status-published-border)] bg-[var(--status-published-bg)] text-[var(--status-published-text)]',
  attention:
    'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]',
  empty:
    'border-[var(--border-soft)] bg-[var(--bg-subtle)] text-[var(--text-muted)]',
};

type EvidenceCenterView = 'builder' | 'presentation';

export default function EvidenceCenterPage() {
  const { session } = useAuth();
  const hasAccess = canViewAudit(session);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const [pendingRecommendationId, setPendingRecommendationId] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [selectedRecommendationIds, setSelectedRecommendationIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<EvidenceCenterView>('builder');

  const securityQuery = useQuery({
    queryKey: auditKeys.securitySummary(),
    queryFn: getSecuritySummary,
    enabled: hasAccess,
  });
  const retentionQuery = useQuery({
    queryKey: retentionKeys.evidence(),
    queryFn: () => getRetentionEvidence(),
    enabled: hasAccess,
  });

  const securityModel = useMemo(
    () =>
      securityQuery.data
        ? buildSecurityDashboardModel(securityQuery.data, undefined, {
            now: generatedAt,
          })
        : null,
    [generatedAt, securityQuery.data],
  );
  const model = useMemo(
    () =>
      securityQuery.data && retentionQuery.data
        ? buildEvidenceCenterModel({
            securitySummary: securityQuery.data,
            retentionEvidence: retentionQuery.data,
            generatedAt,
          })
        : null,
    [generatedAt, retentionQuery.data, securityQuery.data],
  );
  const selectedRecommendationIdSet = useMemo(
    () => new Set(selectedRecommendationIds),
    [selectedRecommendationIds],
  );
  const selectedDocumentIdSet = useMemo(
    () => new Set(selectedDocumentIds),
    [selectedDocumentIds],
  );
  const bundlePreview = useMemo(
    () =>
      model
        ? buildEvidenceBundle(model, {
            selectedRecommendationIds,
            selectedDocumentIds,
          })
        : null,
    [model, selectedDocumentIds, selectedRecommendationIds],
  );
  const caseNarrative = useMemo(
    () => (bundlePreview ? buildEvidenceCaseNarrative(bundlePreview) : null),
    [bundlePreview],
  );

  async function refreshEvidenceCenter() {
    setDownloadError(null);
    setGeneratedAt(new Date().toISOString());
    await Promise.all([securityQuery.refetch(), retentionQuery.refetch()]);
  }

  function downloadManifest(currentModel: EvidenceCenterModel) {
    downloadJson(
      buildEvidenceCenterManifest(currentModel),
      'docvault-evidence-center-manifest.json',
    );
  }

  function downloadBundle(currentModel: EvidenceCenterModel) {
    const bundle = buildEvidenceBundle(currentModel, {
      selectedRecommendationIds,
      selectedDocumentIds,
      generatedAt: new Date().toISOString(),
    });
    downloadJson(bundle, bundle.bundleFilename);
  }

  function downloadReport(currentModel: EvidenceCenterModel) {
    const bundle = buildEvidenceBundle(currentModel, {
      selectedRecommendationIds,
      selectedDocumentIds,
      generatedAt: new Date().toISOString(),
    });
    const narrative = buildEvidenceCaseNarrative(bundle);
    downloadHtml(
      buildEvidenceReportHtml(bundle, narrative),
      `${bundle.bundleId}-report.html`,
    );
  }

  async function copyEvidenceText(value: string) {
    setDownloadError(null);
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setDownloadError('Failed to copy evidence value.');
    }
  }

  function toggleRecommendationSelection(id: string) {
    setSelectedRecommendationIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleDocumentSelection(id: string) {
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAllRecommendations(currentModel: EvidenceCenterModel) {
    setSelectedRecommendationIds(
      currentModel.recommendationTargets.map((item) => item.id),
    );
  }

  function selectAllDocuments(currentModel: EvidenceCenterModel) {
    setSelectedDocumentIds(
      currentModel.documentPacketTargets.map((item) => item.docId),
    );
  }

  function clearBundleSelection() {
    setSelectedRecommendationIds([]);
    setSelectedDocumentIds([]);
  }

  async function downloadRecommendationPacket(target: EvidenceRecommendationTarget) {
    if (!securityModel || !securityQuery.data) return;

    setPendingRecommendationId(target.id);
    setDownloadError(null);
    try {
      const recommendation = securityModel.recommendations.items.find(
        (item) => item.id === target.id,
      );
      if (!recommendation) {
        throw new Error('Recommendation is no longer available.');
      }

      const workflowHistory = await getSecurityRecommendationWorkflowHistory(target.id);
      const packet = buildRecommendationEvidencePacket({
        recommendation,
        auditChain: securityQuery.data.chain,
        workflowHistory,
        generatedAt: new Date().toISOString(),
      });
      downloadJson(packet, target.packetFilename);
    } catch {
      setDownloadError('Failed to export recommendation packet.');
    } finally {
      setPendingRecommendationId(null);
    }
  }

  async function downloadDocumentPacket(target: EvidenceDocumentPacketTarget) {
    setPendingDocumentId(target.docId);
    setDownloadError(null);
    try {
      const packet = buildEvidenceCenterDocumentPacket(
        await getComplianceEvidencePacket(target.docId),
      );
      downloadJson(packet, target.packetFilename);
    } catch {
      setDownloadError('Failed to export document packet.');
    } finally {
      setPendingDocumentId(null);
    }
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon="lock"
        title="Access Denied"
        description="You need the Compliance Officer or Admin role to view evidence exports."
      />
    );
  }

  if (securityQuery.isLoading || retentionQuery.isLoading) {
    return <LoadingState label="Loading evidence center..." />;
  }

  if (securityQuery.isError || retentionQuery.isError || !model) {
    return (
      <ErrorState
        message="Failed to load evidence center."
        onRetry={refreshEvidenceCenter}
      />
    );
  }

  const isRefreshing = securityQuery.isFetching || retentionQuery.isFetching;

  return (
    <div>
      <PageHeader
        title="Evidence Center"
        subtitle="Compliance evidence workspace for audit chain, recommendations, document packets, and retention records."
        actions={
          <>
            <button
              type="button"
              onClick={refreshEvidenceCenter}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => downloadManifest(model)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--text-main)] px-3 py-2 text-sm font-medium text-[var(--bg-card)] transition hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Export manifest
            </button>
          </>
        }
      />

      {downloadError ? (
        <p className="mt-3 text-sm font-medium text-[var(--state-error-text)]">
          {downloadError}
        </p>
      ) : null}

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {model.sourceCards.map((card) => (
          <div
            key={card.key}
            className="rounded-lg border p-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-faint)]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">
                  {card.value}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceStateTone[card.state]}`}
              >
                {card.state}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              {card.description}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-4 inline-flex rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-1">
        <button
          type="button"
          aria-pressed={activeView === 'builder'}
          onClick={() => setActiveView('builder')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeView === 'builder'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Builder
        </button>
        <button
          type="button"
          aria-pressed={activeView === 'presentation'}
          onClick={() => setActiveView('presentation')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeView === 'presentation'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Presentation
        </button>
      </div>

      {activeView === 'builder' ? (
        <>
          <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <RecommendationPacketQueue
              items={model.recommendationTargets}
              pendingId={pendingRecommendationId}
              selectedIds={selectedRecommendationIdSet}
              onToggleSelection={toggleRecommendationSelection}
              onDownload={downloadRecommendationPacket}
            />
            <EvidenceBundlePanel
              model={model}
              bundle={bundlePreview}
              onExport={() => downloadBundle(model)}
              onExportReport={() => downloadReport(model)}
              onSelectAllRecommendations={() => selectAllRecommendations(model)}
              onSelectAllDocuments={() => selectAllDocuments(model)}
              onClear={clearBundleSelection}
            />
          </section>

          <section className="mt-4">
            <DocumentPacketTargets
              items={model.documentPacketTargets}
              pendingId={pendingDocumentId}
              selectedIds={selectedDocumentIdSet}
              onToggleSelection={toggleDocumentSelection}
              onDownload={downloadDocumentPacket}
            />
          </section>
        </>
      ) : (
        <section className="mt-4">
          <EvidenceCasePresentation
            bundle={bundlePreview}
            narrative={caseNarrative}
            onCopy={copyEvidenceText}
            onExportBundle={() => downloadBundle(model)}
            onExportReport={() => downloadReport(model)}
          />
        </section>
      )}
    </div>
  );
}

function EvidenceBundlePanel({
  model,
  bundle,
  onExport,
  onExportReport,
  onSelectAllRecommendations,
  onSelectAllDocuments,
  onClear,
}: {
  model: EvidenceCenterModel;
  bundle: EvidenceBundleManifest | null;
  onExport: () => void;
  onExportReport: () => void;
  onSelectAllRecommendations: () => void;
  onSelectAllDocuments: () => void;
  onClear: () => void;
}) {
  const totalPackets = bundle?.summary.totalPackets ?? 0;

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
    >
      <div className="flex items-start gap-3">
        {model.auditChain.valid ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--status-published-text)]" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 text-[var(--state-error-text)]" />
        )}
        <div>
          <h2 className="text-base font-semibold text-[var(--text-main)]">
            Demo bundle manifest
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            Metadata-only index for the evidence set. Export individual packets
            from the queues, then use this manifest as the report checklist.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <EvidenceLink href={ROUTES.AUDIT} label="Audit chain and query evidence" />
        <EvidenceLink href={ROUTES.SECURITY} label="Security recommendations and playbooks" />
        <EvidenceLink href={ROUTES.RETENTION} label="Retention evidence records" />
      </div>

      <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              Evidence bundle builder
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Select packets in the queues and export a metadata-only case
              manifest for the demo bundle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={totalPackets === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--text-main)] px-3 text-sm font-medium text-[var(--bg-card)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Bundle
            </button>
            <button
              type="button"
              onClick={onExportReport}
              disabled={totalPackets === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              Report
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <BundleMetric label="Recommendations" value={bundle?.summary.recommendationPackets ?? 0} />
          <BundleMetric label="Documents" value={bundle?.summary.documentPackets ?? 0} />
          <BundleMetric label="Total packets" value={totalPackets} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAllRecommendations}
            className="rounded border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
          >
            Select recommendations
          </button>
          <button
            type="button"
            onClick={onSelectAllDocuments}
            className="rounded border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
          >
            Select documents
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)]"
          >
            Clear
          </button>
        </div>

        {bundle ? (
          <div className="mt-3 space-y-2">
            {bundle.checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-xs"
              >
                <span className="font-medium text-[var(--text-main)]">
                  {item.label}
                </span>
                <span
                  className={
                    item.complete
                      ? 'text-[var(--status-published-text)]'
                      : 'text-[var(--status-pending-text)]'
                  }
                >
                  {item.complete ? 'ready' : 'pending'} · {item.evidenceCount}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">
        <p>Generated {formatDateTime(model.generatedAt)}</p>
        <p className="mt-1">
          Excludes file content, object keys, presigned URLs, and grant tokens.
        </p>
      </div>
    </div>
  );
}

function EvidenceCasePresentation({
  bundle,
  narrative,
  onCopy,
  onExportBundle,
  onExportReport,
}: {
  bundle: EvidenceBundleManifest | null;
  narrative: EvidenceCaseNarrative | null;
  onCopy: (value: string) => void | Promise<void>;
  onExportBundle: () => void;
  onExportReport: () => void;
}) {
  if (!bundle || !narrative) {
    return null;
  }

  const readinessNotes = [...narrative.blockers, ...narrative.warnings];
  const hasPackets = bundle.summary.totalPackets > 0;

  return (
    <div
      className="rounded-lg border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
    >
      <div className="border-b px-4 py-4" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={caseStatusClass(narrative.status)}>
                {narrative.status}
              </span>
              <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
                Metadata-only
              </span>
              <span className={integrityBadgeClass(narrative.integrityBadge.state)}>
                {narrative.integrityBadge.label}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-main)]">
              {narrative.caseId}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {narrative.headline}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCopy(narrative.caseId)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
            >
              <Clipboard className="h-4 w-4" />
              Case ID
            </button>
            <button
              type="button"
              onClick={() => onCopy(bundle.bundleFilename)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
            >
              <Clipboard className="h-4 w-4" />
              Filename
            </button>
            <button
              type="button"
              onClick={onExportBundle}
              disabled={!hasPackets}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-main)] px-3 text-sm font-medium text-[var(--bg-card)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Bundle
            </button>
            <button
              type="button"
              onClick={onExportReport}
              disabled={!hasPackets}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <BundleMetric
              label="Recommendations"
              value={bundle.summary.recommendationPackets}
            />
            <BundleMetric
              label="Documents"
              value={bundle.summary.documentPackets}
            />
            <BundleMetric
              label="Audit events"
              value={narrative.auditChain.checkedEvents}
            />
            <BundleMetric
              label="Missing"
              value={bundle.summary.missingSelections}
            />
          </div>

          <div
            className={`rounded border p-3 ${integrityPanelClass(
              narrative.integrityBadge.state,
            )}`}
          >
            <div className="flex items-start gap-2">
              {narrative.integrityBadge.state === 'verified' ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--status-published-text)]" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--state-error-text)]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  {narrative.integrityBadge.label}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {narrative.integrityBadge.detail}.
                </p>
              </div>
            </div>
          </div>

          <EvidenceSectionSummary sections={narrative.sections} />

          <div className="rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3">
            <p className="text-sm font-semibold text-[var(--text-main)]">
              Retention posture
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {narrative.retentionPosture.label}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
              <MiniMetric label="Tracked" value={narrative.retentionPosture.tracked} />
              <MiniMetric label="Due soon" value={narrative.retentionPosture.dueSoon} />
              <MiniMetric label="Overdue" value={narrative.retentionPosture.overdue} />
              <MiniMetric label="Archived" value={narrative.retentionPosture.archived} />
            </div>
          </div>

          {readinessNotes.length > 0 ? (
            <div className="rounded border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--status-pending-text)]">
                Readiness notes
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--status-pending-text)]">
                {readinessNotes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <EvidenceVisualTimeline items={narrative.visualTimeline} />

          <div className="rounded border border-[var(--border-soft)]">
            <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">
                Case checklist
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              {narrative.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-[var(--text-main)]">
                    {item.label}
                  </span>
                  <span
                    className={
                      item.complete
                        ? 'text-[var(--status-published-text)]'
                        : 'text-[var(--status-pending-text)]'
                    }
                  >
                    {item.complete ? 'ready' : 'pending'} - {item.evidenceCount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-[var(--border-soft)]">
            <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">
                Recommendation timeline
              </h3>
            </div>
            {narrative.timeline.length === 0 ? (
              <p className="px-3 py-3 text-sm text-[var(--text-muted)]">
                No recommendation packet selected.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-soft)]">
                {narrative.timeline.map((item) => (
                  <div key={item.id} className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-muted)]">
                        #{item.sequence}
                      </span>
                      <span className={badgeClass(item.severity)}>
                        {item.severity}
                      </span>
                      <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
                        {item.workflowStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                      {item.title}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                      {item.packetFilename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-[var(--border-soft)]">
            <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">
                Document packets
              </h3>
            </div>
            {narrative.documents.length === 0 ? (
              <p className="px-3 py-3 text-sm text-[var(--text-muted)]">
                No document packet selected.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-soft)]">
                {narrative.documents.map((item) => (
                  <div key={item.id} className="px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--text-main)]">
                      {item.title}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                        {item.classification}
                      </span>
                      <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                        {item.retentionStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-[var(--text-faint)]">
                      {item.packetFilename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceSectionSummary({
  sections,
}: {
  sections: EvidenceCaseNarrative['sections'];
}) {
  return (
    <div className="rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-main)]">
          Evidence packet sections
        </p>
        <span className="text-xs font-medium text-[var(--text-muted)]">
          {sections.length} groups
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded border border-[var(--border-soft)] bg-[var(--bg-card)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase text-[var(--text-main)]">
                {section.label}
              </h3>
              <span className={sectionStateClass(section.state)}>
                {section.state}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              {section.summary}
            </p>
            <p className="mt-2 text-xs font-medium text-[var(--text-main)]">
              {section.evidenceCount} evidence items
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceVisualTimeline({
  items,
}: {
  items: EvidenceCaseNarrative['visualTimeline'];
}) {
  return (
    <div className="rounded border border-[var(--border-soft)]">
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <h3 className="text-sm font-semibold text-[var(--text-main)]">
          Visual timeline
        </h3>
      </div>
      <div className="px-3 py-3">
        <ol className="space-y-0">
          {items.map((item, index) => (
            <li
              key={item.sectionId}
              className="grid grid-cols-[32px_1fr] gap-3"
            >
              <div className="flex flex-col items-center">
                <span className={timelineDotClass(item.state)}>
                  {item.sequence}
                </span>
                {index < items.length - 1 ? (
                  <span className="h-full min-h-8 w-px bg-[var(--border-soft)]" />
                ) : null}
              </div>
              <div className="pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-main)]">
                    {item.label}
                  </p>
                  <span className={sectionStateClass(item.state)}>
                    {item.state}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function BundleMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--text-faint)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--text-main)]">
        {value}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-[var(--bg-card)] px-2 py-1">
      <p className="font-semibold text-[var(--text-main)]">{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">{label}</p>
    </div>
  );
}

function RecommendationPacketQueue({
  items,
  pendingId,
  selectedIds,
  onToggleSelection,
  onDownload,
}: {
  items: EvidenceRecommendationTarget[];
  pendingId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onDownload: (item: EvidenceRecommendationTarget) => Promise<void>;
}) {
  return (
    <div
      className="rounded-lg border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Recommendation packet queue
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Export recommendation packets with audit chain, workflow history, and
          playbook metadata.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-muted)]">
          No security recommendation packets are waiting.
        </p>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {items.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-main)]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => onToggleSelection(item.id)}
                        className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                      />
                      Bundle
                    </label>
                    <span className={badgeClass(item.severity)}>
                      {item.severity}
                    </span>
                    <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
                      {item.workflowStatus}
                    </span>
                    <span className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
                      {item.ownerLabel}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                    {item.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={item.auditQuery ? `${ROUTES.AUDIT}?${item.auditQuery}` : ROUTES.AUDIT}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Audit
                  </Link>
                  {item.affectedDocumentId ? (
                    <Link
                      href={ROUTES.DOCUMENT_DETAIL(item.affectedDocumentId)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Document
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDownload(item)}
                    disabled={pendingId === item.id}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-main)] px-3 text-sm font-medium text-[var(--bg-card)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {pendingId === item.id ? 'Exporting...' : 'Packet'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentPacketTargets({
  items,
  pendingId,
  selectedIds,
  onToggleSelection,
  onDownload,
}: {
  items: EvidenceDocumentPacketTarget[];
  pendingId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onDownload: (item: EvidenceDocumentPacketTarget) => Promise<void>;
}) {
  return (
    <div
      className="rounded-lg border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Document evidence packets
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Export document packets from retention evidence records.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-muted)]">
          No document packet targets are available.
        </p>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.docId}
              className="rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3"
            >
              <div className="flex items-start gap-3">
                <FileJson className="mt-0.5 h-5 w-5 text-[var(--text-muted)]" />
                <div className="min-w-0 flex-1">
                  <label className="mb-2 inline-flex items-center gap-1.5 rounded border border-[var(--border-soft)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)]">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.docId)}
                      onChange={() => onToggleSelection(item.docId)}
                      className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                    />
                    Bundle
                  </label>
                  <Link
                    href={ROUTES.DOCUMENT_DETAIL(item.docId)}
                    className="block truncate text-sm font-semibold text-[var(--text-main)] hover:text-[var(--color-primary)]"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                    {item.docId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-muted)]">
                      {item.classification}
                    </span>
                    <span className="rounded bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-muted)]">
                      {item.retentionStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDownload(item)}
                disabled={pendingId === item.docId}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Archive className="h-4 w-4" />
                {pendingId === item.docId ? 'Exporting...' : 'Export packet'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-between rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)]"
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4 text-[var(--text-faint)]" />
    </Link>
  );
}

function caseStatusClass(status: EvidenceCaseNarrative['status']): string {
  if (status === 'ready') {
    return 'rounded border border-[var(--status-published-border)] bg-[var(--status-published-bg)] px-2 py-1 text-xs font-semibold uppercase text-[var(--status-published-text)]';
  }
  if (status === 'blocked') {
    return 'rounded border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-2 py-1 text-xs font-semibold uppercase text-[var(--state-error-text)]';
  }
  return 'rounded border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] px-2 py-1 text-xs font-semibold uppercase text-[var(--status-pending-text)]';
}

function integrityBadgeClass(
  state: EvidenceCaseNarrative['integrityBadge']['state'],
): string {
  if (state === 'verified') {
    return 'rounded border border-[var(--status-published-border)] bg-[var(--status-published-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-published-text)]';
  }

  return 'rounded border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-2 py-1 text-xs font-semibold text-[var(--state-error-text)]';
}

function integrityPanelClass(
  state: EvidenceCaseNarrative['integrityBadge']['state'],
): string {
  if (state === 'verified') {
    return 'border-[var(--status-published-border)] bg-[var(--status-published-bg)]';
  }

  return 'border-[var(--state-error-border)] bg-[var(--state-error-bg)]';
}

function sectionStateClass(
  state: EvidenceCaseNarrative['sections'][number]['state'],
): string {
  if (state === 'verified' || state === 'ready') {
    return 'rounded bg-[var(--status-published-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--status-published-text)]';
  }
  if (state === 'blocked') {
    return 'rounded bg-[var(--state-error-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--state-error-text)]';
  }
  return 'rounded bg-[var(--status-pending-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--status-pending-text)]';
}

function timelineDotClass(
  state: EvidenceCaseNarrative['visualTimeline'][number]['state'],
): string {
  if (state === 'verified' || state === 'ready') {
    return 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--status-published-text)] text-xs font-semibold text-[var(--bg-card)]';
  }
  if (state === 'blocked') {
    return 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--state-error-text)] text-xs font-semibold text-[var(--bg-card)]';
  }
  return 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--status-pending-text)] text-xs font-semibold text-[var(--bg-card)]';
}

function badgeClass(severity: EvidenceRecommendationTarget['severity']): string {
  if (severity === 'critical') {
    return 'rounded bg-[var(--state-error-bg)] px-2 py-1 text-xs font-semibold text-[var(--state-error-text)]';
  }
  if (severity === 'warning') {
    return 'rounded bg-[var(--status-pending-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-pending-text)]';
  }
  return 'rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-muted)]';
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadHtml(value: string, filename: string) {
  const blob = new Blob([value], {
    type: 'text/html',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
