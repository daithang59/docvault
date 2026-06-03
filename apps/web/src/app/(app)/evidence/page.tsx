'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  Download,
  ExternalLink,
  FileJson,
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
  buildEvidenceCenterManifest,
  buildEvidenceCenterModel,
  buildEvidenceCenterDocumentPacket,
  type EvidenceCenterModel,
  type EvidenceDocumentPacketTarget,
  type EvidenceRecommendationTarget,
  type EvidenceSourceState,
} from '@/features/evidence/evidence-center';
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

export default function EvidenceCenterPage() {
  const { session } = useAuth();
  const hasAccess = canViewAudit(session);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const [pendingRecommendationId, setPendingRecommendationId] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <RecommendationPacketQueue
          items={model.recommendationTargets}
          pendingId={pendingRecommendationId}
          onDownload={downloadRecommendationPacket}
        />
        <EvidenceBundlePanel model={model} />
      </section>

      <section className="mt-4">
        <DocumentPacketTargets
          items={model.documentPacketTargets}
          pendingId={pendingDocumentId}
          onDownload={downloadDocumentPacket}
        />
      </section>
    </div>
  );
}

function EvidenceBundlePanel({ model }: { model: EvidenceCenterModel }) {
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

      <div className="mt-4 rounded border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">
        <p>Generated {formatDateTime(model.generatedAt)}</p>
        <p className="mt-1">
          Excludes file content, object keys, presigned URLs, and grant tokens.
        </p>
      </div>
    </div>
  );
}

function RecommendationPacketQueue({
  items,
  pendingId,
  onDownload,
}: {
  items: EvidenceRecommendationTarget[];
  pendingId: string | null;
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
  onDownload,
}: {
  items: EvidenceDocumentPacketTarget[];
  pendingId: string | null;
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
