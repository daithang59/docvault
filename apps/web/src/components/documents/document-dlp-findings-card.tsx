'use client';

import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import type { DocumentDetail, DocumentVersion } from '@/types/document';
import type { ClassificationLevel } from '@/types/enums';
import { formatDateTime } from '@/lib/utils/date';

type DlpStatus = 'NOT_SCANNED' | 'CLEAR' | 'DETECTED';
type DlpSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

type DlpCarrier = {
  status: DlpStatus;
  findings: Array<Record<string, unknown>>;
  source: string;
  detectedAt?: string | null;
  suggestedClassification?: ClassificationLevel | null;
};

const STATUS_META: Record<
  DlpStatus,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClassName: string;
  }
> = {
  DETECTED: {
    label: 'Detected',
    description: 'Sensitive patterns were detected. Raw matched values are hidden.',
    icon: ShieldAlert,
    badgeClassName:
      'border-[var(--state-error-border)] bg-[var(--state-error-bg)] text-[var(--state-error-text)]',
  },
  CLEAR: {
    label: 'Clear',
    description: 'No DLP findings were reported for the stored scan result.',
    icon: ShieldCheck,
    badgeClassName:
      'border-[var(--status-published-border)] bg-[var(--status-published-bg)] text-[var(--status-published-text)]',
  },
  NOT_SCANNED: {
    label: 'Not scanned',
    description: 'No DLP scan result has been recorded yet.',
    icon: ShieldQuestion,
    badgeClassName: 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
  },
};

const SEVERITY_RANK: Record<DlpSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

interface DocumentDlpFindingsCardProps {
  doc: DocumentDetail;
}

export function DocumentDlpFindingsCard({ doc }: DocumentDlpFindingsCardProps) {
  const latestVersion = getLatestVersion(doc.versions ?? []);
  const dlp = resolveDlpState(doc, latestVersion);
  const statusMeta = STATUS_META[dlp.status];
  const StatusIcon = statusMeta.icon;
  const summaries = summarizeFindings(dlp.findings);
  const totalFindings = summaries.reduce((total, finding) => total + finding.count, 0);
  const suggestedClassification =
    dlp.suggestedClassification ?? (dlp.status === 'DETECTED' ? 'CONFIDENTIAL' : null);

  return (
    <section
      className="rounded-2xl border bg-[var(--bg-card)] p-5"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="dlp-findings-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[var(--text-faint)]" />
            <h2 id="dlp-findings-heading" className="text-sm font-semibold text-[var(--text-strong)]">
              DLP findings
            </h2>
          </div>
          <p className="text-xs text-[var(--text-faint)]">{dlp.source}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${statusMeta.badgeClassName}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3" style={{ borderColor: 'var(--border-soft)' }}>
        <SecurityMeta label="Scan status" value={statusMeta.description} />
        <div>
          <SecurityMetaLabel label="Suggested classification" />
          {suggestedClassification ? (
            <div className="mt-1">
              <ClassificationBadge classification={suggestedClassification} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-main)]">No escalation suggested</p>
          )}
        </div>
        <SecurityMeta
          label="Finding count"
          value={
            totalFindings > 0
              ? `${totalFindings} across ${summaries.length} categor${summaries.length === 1 ? 'y' : 'ies'}`
              : 'No finding categories reported'
          }
        />
      </div>

      {dlp.detectedAt && (
        <p className="mt-3 text-xs text-[var(--text-faint)]">Detected {formatDateTime(dlp.detectedAt)}</p>
      )}

      {summaries.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {summaries.map((finding) => (
            <span
              key={finding.category}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--text-main)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              <span className="font-medium">{finding.category}</span>
              <span className="text-[var(--text-muted)]">{finding.count}</span>
              {finding.severity && (
                <span className="text-[var(--text-faint)]">{finding.severity.toLowerCase()}</span>
              )}
            </span>
          ))}
        </div>
      ) : dlp.status === 'DETECTED' ? (
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Detection was recorded, but this API response did not include category counts.
        </p>
      ) : null}
    </section>
  );
}

function SecurityMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <SecurityMetaLabel label={label} />
      <p className="mt-1 text-sm text-[var(--text-main)]">{value}</p>
    </div>
  );
}

function SecurityMetaLabel({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
      {label}
    </span>
  );
}

function resolveDlpState(doc: DocumentDetail, latestVersion?: DocumentVersion): DlpCarrier {
  const documentFindings = safeFindings(doc.dlpFindings);
  const documentStatus = normalizeStatus(doc.dlpStatus);

  if (documentStatus || documentFindings.length > 0 || doc.dlpDetectedAt) {
    return {
      status: documentStatus ?? (documentFindings.length > 0 ? 'DETECTED' : 'NOT_SCANNED'),
      findings: documentFindings,
      source: 'Document aggregate',
      detectedAt: doc.dlpDetectedAt,
      suggestedClassification: readSuggestedClassification(doc),
    };
  }

  const versionFindings = safeFindings(latestVersion?.dlpFindings);
  const versionStatus = normalizeStatus(latestVersion?.dlpStatus);

  if (latestVersion) {
    const versionNumber = latestVersion.versionNumber ?? latestVersion.version ?? doc.currentVersion;

    return {
      status: versionStatus ?? (versionFindings.length > 0 ? 'DETECTED' : 'NOT_SCANNED'),
      findings: versionFindings,
      source: `Latest version v${versionNumber}`,
      suggestedClassification: readSuggestedClassification(latestVersion),
    };
  }

  return {
    status: 'NOT_SCANNED',
    findings: [],
    source: 'No file versions available',
    suggestedClassification: null,
  };
}

function getLatestVersion(versions: DocumentVersion[]) {
  return [...versions].sort(
    (a, b) => (b.versionNumber ?? b.version ?? 0) - (a.versionNumber ?? a.version ?? 0),
  )[0];
}

function summarizeFindings(findings: Array<Record<string, unknown>>) {
  const grouped = new Map<string, { category: string; count: number; severity?: DlpSeverity }>();

  for (const finding of findings) {
    const category = formatCategory(readString(finding.type) ?? 'OTHER');
    const count = readCount(finding.count);
    const severity = normalizeSeverity(finding.severity);
    const current = grouped.get(category);

    if (!current) {
      grouped.set(category, { category, count, severity });
      continue;
    }

    grouped.set(category, {
      category,
      count: current.count + count,
      severity: strongerSeverity(current.severity, severity),
    });
  }

  return [...grouped.values()].sort((a, b) => {
    const severityDelta = (SEVERITY_RANK[b.severity ?? 'LOW'] ?? 0) - (SEVERITY_RANK[a.severity ?? 'LOW'] ?? 0);
    return severityDelta || b.count - a.count || a.category.localeCompare(b.category);
  });
}

function safeFindings(findings: DocumentDetail['dlpFindings'] | DocumentVersion['dlpFindings']) {
  return (findings ?? []).filter(isRecord);
}

function normalizeStatus(status: unknown): DlpStatus | null {
  return status === 'NOT_SCANNED' || status === 'CLEAR' || status === 'DETECTED' ? status : null;
}

function normalizeSeverity(severity: unknown): DlpSeverity | undefined {
  return severity === 'LOW' || severity === 'MEDIUM' || severity === 'HIGH' ? severity : undefined;
}

function strongerSeverity(left?: DlpSeverity, right?: DlpSeverity) {
  if (!left) return right;
  if (!right) return left;
  return SEVERITY_RANK[right] > SEVERITY_RANK[left] ? right : left;
}

function readSuggestedClassification(value: unknown): ClassificationLevel | null {
  if (!isRecord(value)) return null;

  const suggested = value.dlpSuggestedClassification ?? value.suggestedClassification;
  return isClassificationLevel(suggested) ? suggested : null;
}

function isClassificationLevel(value: unknown): value is ClassificationLevel {
  return value === 'PUBLIC' || value === 'INTERNAL' || value === 'CONFIDENTIAL' || value === 'SECRET';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readCount(value: unknown) {
  const count = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
