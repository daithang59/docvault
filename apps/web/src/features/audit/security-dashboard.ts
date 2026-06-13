import { ROUTES } from '@/lib/constants/routes';
import type {
  AuditChainStatus,
  AuditLogEntry,
  AuditQueryFilters,
  BehaviorSignalSummary,
  RiskyDocumentSummary,
  SecurityRecommendationWorkflowHistoryEntry,
  SecurityRecommendationWorkflow,
  SecurityRecommendationSummary,
  SecuritySummary,
} from './audit.types';

export type SecurityPostureLevel = 'healthy' | 'warning' | 'critical';
export type SecurityAlertSeverity = 'info' | 'warning' | 'critical';
export type SecurityRiskBand = 'critical' | 'warning' | 'watch';
export type SecurityDashboardTone = 'info' | 'success' | 'warning' | 'critical';

export interface SecurityDashboardMetric {
  key: keyof SecuritySummary['totals'];
  label: string;
  value: number;
  description: string;
}

export interface SecurityDashboardAlert {
  severity: SecurityAlertSeverity;
  title: string;
  description: string;
  action: string;
}

export interface SecurityDashboardGaugeSummary {
  label: string;
  value: number;
  tone: SecurityDashboardTone;
  description: string;
  href: string;
}

export interface SecurityDashboardSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  tone: SecurityDashboardTone;
  href?: string;
}

export interface SecurityCommandCenter {
  postureGauge: SecurityDashboardGaugeSummary;
  alertSegments: SecurityDashboardSegment[];
  riskBandSegments: SecurityDashboardSegment[];
  anomalyBandSegments: SecurityDashboardSegment[];
  recommendationSlaSegments: SecurityDashboardSegment[];
  accessSegments: SecurityDashboardSegment[];
}

export interface SecurityRiskScoringRow extends RiskyDocumentSummary {
  riskBand: SecurityRiskBand;
  riskLabel: string;
  auditFilters: AuditQueryFilters;
}

export interface SecurityBehaviorSignalRow extends BehaviorSignalSummary {
  typeLabel: string;
  riskBand: SecurityRiskBand;
  riskLabel: string;
  auditFilters: AuditQueryFilters;
}

export interface SecurityRecommendationRow
  extends Omit<SecurityRecommendationSummary, 'workflow'> {
  workflow: SecurityRecommendationWorkflow;
  playbook: SecurityRecommendationPlaybook;
  severityLabel: string;
  typeLabel: string;
  auditFilters: AuditQueryFilters;
}

export type SecurityRecommendationSlaState =
  | 'not-started'
  | 'on-track'
  | 'due-soon'
  | 'overdue'
  | 'closed';

export interface SecurityRecommendationPlaybookStep {
  id: 'triage' | 'investigate' | 'review' | 'resolve';
  label: string;
  evidenceHint: string;
  isComplete: boolean;
}

export interface SecurityRecommendationPlaybook {
  ownerLabel: string;
  slaHours: number;
  dueAt: string | null;
  slaState: SecurityRecommendationSlaState;
  steps: SecurityRecommendationPlaybookStep[];
}

export interface SecurityDashboardModel {
  posture: {
    level: SecurityPostureLevel;
    label: string;
    description: string;
  };
  commandCenter: SecurityCommandCenter;
  metrics: SecurityDashboardMetric[];
  alerts: SecurityDashboardAlert[];
  repeatedDenyActors: Array<{
    actorId: string;
    denyCount: number;
    riskLabel: string;
  }>;
  activity: {
    downloadAuthorizedTotal: number;
    sensitiveAccessCount: number;
    sensitiveAccessEvents: AuditLogEntry[];
  };
  riskScoring: {
    riskyDocuments: SecurityRiskScoringRow[];
  };
  behaviorAnomalies: {
    signals: SecurityBehaviorSignalRow[];
  };
  recommendations: {
    items: SecurityRecommendationRow[];
  };
  quickFilters: Array<{
    label: string;
    description: string;
    filters: AuditQueryFilters;
  }>;
}

export interface SecurityRecommendationEvidencePacket {
  generatedAt: string;
  metadataOnly: true;
  excludedSensitiveFields: string[];
  auditChain: AuditChainStatus;
  recommendation: SecurityRecommendationRow;
  playbook: SecurityRecommendationPlaybook;
  workflowHistory: SecurityRecommendationWorkflowHistoryEntry[];
}

export function buildRecommendationEvidencePacket({
  recommendation,
  auditChain,
  workflowHistory,
  generatedAt,
}: {
  recommendation: SecurityRecommendationRow;
  auditChain: AuditChainStatus;
  workflowHistory: SecurityRecommendationWorkflowHistoryEntry[];
  generatedAt: string;
}): SecurityRecommendationEvidencePacket {
  return {
    generatedAt,
    metadataOnly: true,
    excludedSensitiveFields: [
      'fileContent',
      'objectKey',
      'presignedUrl',
      'grantToken',
    ],
    auditChain,
    recommendation,
    playbook: recommendation.playbook,
    workflowHistory,
  };
}

export interface SecurityDashboardModelOptions {
  now?: string | Date;
}

export function buildSecurityDashboardModel(
  summary: SecuritySummary | null | undefined,
  activity?: {
    downloadAuthorizedTotal?: number;
    sensitiveAccessEvents?: AuditLogEntry[];
  },
  options: SecurityDashboardModelOptions = {},
): SecurityDashboardModel {
  const totals = summary?.totals ?? {
    deniedEvents: 0,
    malwareBlocked: 0,
    dlpDetections: 0,
    downloadDenied: 0,
  };

  const alerts: SecurityDashboardAlert[] = [];
  const sensitiveAccessEvents = (activity?.sensitiveAccessEvents ?? []).filter(
    isSensitiveAccessEvent,
  );
  const downloadAuthorizedTotal = activity?.downloadAuthorizedTotal ?? 0;
  const riskyDocuments = buildRiskScoringRows(summary?.riskyDocuments ?? []);
  const behaviorSignals = buildBehaviorSignalRows(
    summary?.behaviorSignals ?? [],
  );
  const recommendations = buildRecommendationRows(
    summary?.recommendations ?? [],
    normalizeNow(options.now),
  );

  if (summary?.chain.valid === false) {
    alerts.push({
      severity: 'critical',
      title: 'Audit chain invalid',
      description: summary.chain.message ?? 'Hash-chain verification reported a broken audit chain.',
      action: 'Verify tamper evidence before trusting audit exports.',
    });
  }

  const compromisedEpochCount =
    summary?.chain.historicalCompromisedCount ??
    summary?.chain.compromisedEpochs?.length ??
    0;
  if (summary?.chain.valid !== false && compromisedEpochCount > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Historical audit epoch compromised',
      description: `${compromisedEpochCount} previous audit epoch${compromisedEpochCount === 1 ? ' is' : 's are'} marked compromised.`,
      action: 'Review the incident-linked audit epoch before exporting historical evidence.',
    });
  }

  if (totals.malwareBlocked > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Malware upload blocked',
      description: `${totals.malwareBlocked} upload attempt${totals.malwareBlocked === 1 ? '' : 's'} were blocked before storage.`,
      action: 'Review the upload actor, checksum, and source document.',
    });
  }

  if (totals.dlpDetections > 0) {
    alerts.push({
      severity: 'warning',
      title: 'DLP detections recorded',
      description: `${totals.dlpDetections} DLP detection${totals.dlpDetections === 1 ? '' : 's'} require classification review.`,
      action: 'Confirm classification escalation and prevent unsafe downgrades.',
    });
  }

  if ((summary?.repeatedDenyActors.length ?? 0) > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Repeated denied access',
      description: `${summary?.repeatedDenyActors.length ?? 0} actor${summary?.repeatedDenyActors.length === 1 ? '' : 's'} crossed the deny threshold.`,
      action: 'Review account activity',
    });
  }

  if (downloadAuthorizedTotal >= 10) {
    alerts.push({
      severity: 'warning',
      title: 'High download volume',
      description: `${downloadAuthorizedTotal} successful download authorization${downloadAuthorizedTotal === 1 ? '' : 's'} are present in the audit window.`,
      action: 'Review high-volume document access before evidence export.',
    });
  }

  if (sensitiveAccessEvents.length > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Sensitive document access',
      description: `${sensitiveAccessEvents.length} recent CONFIDENTIAL/SECRET preview or download event${sensitiveAccessEvents.length === 1 ? '' : 's'} need review.`,
      action: 'Confirm access intent, actor role, and document classification.',
    });
  }

  if (riskyDocuments.some((document) => document.riskBand === 'critical')) {
    alerts.push({
      severity: 'warning',
      title: 'High-risk document activity',
      description: 'One or more sensitive documents have elevated access frequency or actor spread.',
      action: 'Review the risk scoring panel and open document-scoped audit evidence.',
    });
  }

  if (behaviorSignals.length > 0) {
    const criticalSignals = behaviorSignals.filter(
      (signal) => signal.riskBand === 'critical',
    ).length;
    alerts.push({
      severity: criticalSignals > 0 ? 'critical' : 'warning',
      title: 'Behavior anomaly detected',
      description: `${behaviorSignals.length} actor behavior signal${behaviorSignals.length === 1 ? '' : 's'} matched ransomware-oriented audit patterns.`,
      action: 'Review behavior anomalies and actor-scoped audit evidence.',
    });
  }

  const posture = buildPosture(summary, alerts);

  return {
    posture,
    commandCenter: buildCommandCenter({
      posture,
      alerts,
      riskScoringRows: riskyDocuments,
      behaviorSignalRows: behaviorSignals,
      recommendationRows: recommendations,
      auditChain: summary?.chain,
      downloadAuthorizedTotal,
      sensitiveAccessCount: sensitiveAccessEvents.length,
    }),
    metrics: [
      {
        key: 'deniedEvents',
        label: 'Denied events',
        value: totals.deniedEvents,
        description: 'Policy-denied requests across protected resources.',
      },
      {
        key: 'downloadDenied',
        label: 'Download denied',
        value: totals.downloadDenied,
        description: 'File-content download attempts blocked by policy.',
      },
      {
        key: 'malwareBlocked',
        label: 'Malware blocked',
        value: totals.malwareBlocked,
        description: 'Uploads blocked before object storage.',
      },
      {
        key: 'dlpDetections',
        label: 'DLP hits',
        value: totals.dlpDetections,
        description: 'Sensitive-content detections that affect classification.',
      },
    ],
    alerts,
    repeatedDenyActors: (summary?.repeatedDenyActors ?? []).map((actor) => ({
      ...actor,
      riskLabel: 'Review account activity',
    })),
    activity: {
      downloadAuthorizedTotal,
      sensitiveAccessCount: sensitiveAccessEvents.length,
      sensitiveAccessEvents,
    },
    riskScoring: {
      riskyDocuments,
    },
    behaviorAnomalies: {
      signals: behaviorSignals,
    },
    recommendations: {
      items: recommendations,
    },
    quickFilters: [
      {
        label: 'DENY',
        description: 'Policy-denied activity',
        filters: { result: 'DENY' },
      },
      {
        label: 'ERROR',
        description: 'Failed security operations',
        filters: { result: 'ERROR' },
      },
      {
        label: 'DOWNLOAD DENIED',
        description: 'Blocked file-content access',
        filters: { action: 'DOCUMENT_DOWNLOAD_DENIED' },
      },
      {
        label: 'DLP DETECTED',
        description: 'Sensitive-content findings',
        filters: { action: 'DLP_PATTERN_DETECTED' },
      },
      {
        label: 'DOWNLOAD AUTHORIZED',
        description: 'Successful file-content grants',
        filters: { action: 'DOCUMENT_DOWNLOAD_AUTHORIZED' },
      },
      {
        label: 'PREVIEW AUTHORIZED',
        description: 'Successful content preview grants',
        filters: { action: 'DOCUMENT_PREVIEW_AUTHORIZED' },
      },
    ],
  };
}

export function buildAuditFilterQuery(filters: AuditQueryFilters): string {
  const params = new URLSearchParams();

  if (filters.result) params.set('result', filters.result);
  if (filters.action) params.set('action', filters.action);
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.resourceType) params.set('resourceType', filters.resourceType);
  if (filters.resourceId) params.set('resourceId', filters.resourceId);
  if (filters.documentId) params.set('documentId', filters.documentId);
  if (filters.aclId) params.set('aclId', filters.aclId);
  if (filters.recommendationId) {
    params.set('recommendationId', filters.recommendationId);
  }

  return params.toString();
}

export function isSensitiveAccessEvent(event: AuditLogEntry): boolean {
  if (
    event.action !== 'DOCUMENT_DOWNLOAD_AUTHORIZED' &&
    event.action !== 'DOCUMENT_PREVIEW_AUTHORIZED'
  ) {
    return false;
  }

  const classification = String(event.metadata?.classification ?? '').toUpperCase();
  return classification === 'CONFIDENTIAL' || classification === 'SECRET';
}

function buildBehaviorSignalRows(
  signals: BehaviorSignalSummary[],
): SecurityBehaviorSignalRow[] {
  return signals.map((signal) => {
    const riskBand = getRiskBand(signal.riskScore);

    return {
      ...signal,
      typeLabel: getBehaviorSignalLabel(signal.type),
      riskBand,
      riskLabel: getRiskLabel(riskBand),
      auditFilters: { actorId: signal.actorId },
    };
  });
}

function buildCommandCenter({
  posture,
  alerts,
  riskScoringRows,
  behaviorSignalRows,
  recommendationRows,
  auditChain,
  downloadAuthorizedTotal,
  sensitiveAccessCount,
}: {
  posture: SecurityDashboardModel['posture'];
  alerts: SecurityDashboardAlert[];
  riskScoringRows: SecurityRiskScoringRow[];
  behaviorSignalRows: SecurityBehaviorSignalRow[];
  recommendationRows: SecurityRecommendationRow[];
  auditChain?: AuditChainStatus;
  downloadAuthorizedTotal: number;
  sensitiveAccessCount: number;
}): SecurityCommandCenter {
  return {
    postureGauge: {
      label: 'Security posture',
      value: getPostureScore(posture.level, alerts),
      tone: getPostureTone(posture.level),
      description: `${posture.description} Audit chain checked ${auditChain?.checked ?? 0} event${auditChain?.checked === 1 ? '' : 's'}.`,
      href: ROUTES.AUDIT,
    },
    alertSegments: buildAlertSegments(alerts),
    riskBandSegments: buildRiskBandSegments(riskScoringRows),
    anomalyBandSegments: buildAnomalyBandSegments(behaviorSignalRows),
    recommendationSlaSegments: buildRecommendationSlaSegments(recommendationRows),
    accessSegments: buildAccessSegments(
      downloadAuthorizedTotal,
      sensitiveAccessCount,
    ),
  };
}

function buildAlertSegments(
  alerts: SecurityDashboardAlert[],
): SecurityDashboardSegment[] {
  const counts = alerts.reduce<Record<SecurityAlertSeverity, number>>(
    (acc, alert) => {
      acc[alert.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 },
  );
  const total = alerts.length;

  return [
    {
      key: 'critical',
      label: 'Critical',
      value: counts.critical,
      percentage: toPercentage(counts.critical, total),
      tone: 'critical',
      href: ROUTES.AUDIT,
    },
    {
      key: 'warning',
      label: 'Warning',
      value: counts.warning,
      percentage: toPercentage(counts.warning, total),
      tone: 'warning',
      href: ROUTES.AUDIT,
    },
    {
      key: 'info',
      label: 'Info',
      value: counts.info,
      percentage: toPercentage(counts.info, total),
      tone: 'info',
      href: ROUTES.AUDIT,
    },
  ];
}

function buildRiskBandSegments(
  rows: SecurityRiskScoringRow[],
): SecurityDashboardSegment[] {
  const counts = countRiskBands(rows);
  const total = rows.length;

  return [
    {
      key: 'critical',
      label: 'Critical',
      value: counts.critical,
      percentage: toPercentage(counts.critical, total),
      tone: 'critical',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ resourceType: 'DOCUMENT' })}`,
    },
    {
      key: 'warning',
      label: 'Elevated',
      value: counts.warning,
      percentage: toPercentage(counts.warning, total),
      tone: 'warning',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ resourceType: 'DOCUMENT' })}`,
    },
    {
      key: 'watch',
      label: 'Watch',
      value: counts.watch,
      percentage: toPercentage(counts.watch, total),
      tone: 'info',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ resourceType: 'DOCUMENT' })}`,
    },
  ];
}

function buildAnomalyBandSegments(
  rows: SecurityBehaviorSignalRow[],
): SecurityDashboardSegment[] {
  const counts = countRiskBands(rows);
  const total = rows.length;

  return [
    {
      key: 'critical',
      label: 'Critical',
      value: counts.critical,
      percentage: toPercentage(counts.critical, total),
      tone: 'critical',
      href: ROUTES.AUDIT,
    },
    {
      key: 'warning',
      label: 'Elevated',
      value: counts.warning,
      percentage: toPercentage(counts.warning, total),
      tone: 'warning',
      href: ROUTES.AUDIT,
    },
    {
      key: 'watch',
      label: 'Watch',
      value: counts.watch,
      percentage: toPercentage(counts.watch, total),
      tone: 'info',
      href: ROUTES.AUDIT,
    },
  ];
}

function buildRecommendationSlaSegments(
  rows: SecurityRecommendationRow[],
): SecurityDashboardSegment[] {
  const counts = rows.reduce<Record<SecurityRecommendationSlaState, number>>(
    (acc, row) => {
      acc[row.playbook.slaState] += 1;
      return acc;
    },
    {
      'not-started': 0,
      'on-track': 0,
      'due-soon': 0,
      overdue: 0,
      closed: 0,
    },
  );
  const total = rows.length;

  return [
    {
      key: 'overdue',
      label: 'Overdue',
      value: counts.overdue,
      percentage: toPercentage(counts.overdue, total),
      tone: 'critical',
      href: '#security-recommendations',
    },
    {
      key: 'due-soon',
      label: 'Due soon',
      value: counts['due-soon'],
      percentage: toPercentage(counts['due-soon'], total),
      tone: 'warning',
      href: '#security-recommendations',
    },
    {
      key: 'on-track',
      label: 'On track',
      value: counts['on-track'],
      percentage: toPercentage(counts['on-track'], total),
      tone: 'info',
      href: '#security-recommendations',
    },
    {
      key: 'not-started',
      label: 'Not started',
      value: counts['not-started'],
      percentage: toPercentage(counts['not-started'], total),
      tone: 'warning',
      href: '#security-recommendations',
    },
    {
      key: 'closed',
      label: 'Closed',
      value: counts.closed,
      percentage: toPercentage(counts.closed, total),
      tone: 'success',
      href: '#security-recommendations',
    },
  ];
}

function buildAccessSegments(
  downloadAuthorizedTotal: number,
  sensitiveAccessCount: number,
): SecurityDashboardSegment[] {
  const baseline = Math.max(downloadAuthorizedTotal, sensitiveAccessCount);

  return [
    {
      key: 'download-authorized',
      label: 'Download grants',
      value: downloadAuthorizedTotal,
      percentage: toPercentage(downloadAuthorizedTotal, baseline),
      tone: downloadAuthorizedTotal >= 10 ? 'warning' : 'info',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'DOCUMENT_DOWNLOAD_AUTHORIZED' })}`,
    },
    {
      key: 'sensitive-access',
      label: 'Sensitive grants',
      value: sensitiveAccessCount,
      percentage: toPercentage(sensitiveAccessCount, baseline),
      tone: sensitiveAccessCount > 0 ? 'warning' : 'success',
      href: ROUTES.AUDIT,
    },
  ];
}

function countRiskBands<T extends { riskBand: SecurityRiskBand }>(
  rows: T[],
): Record<SecurityRiskBand, number> {
  return rows.reduce<Record<SecurityRiskBand, number>>(
    (acc, row) => {
      acc[row.riskBand] += 1;
      return acc;
    },
    { critical: 0, warning: 0, watch: 0 },
  );
}

function getPostureScore(
  level: SecurityPostureLevel,
  alerts: SecurityDashboardAlert[],
): number {
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical').length;
  const warningAlerts = alerts.filter((alert) => alert.severity === 'warning').length;
  const infoAlerts = alerts.filter((alert) => alert.severity === 'info').length;
  const rawScore = 100 - criticalAlerts * 25 - warningAlerts * 8 - infoAlerts * 3;

  if (level === 'critical') return Math.max(0, Math.min(65, rawScore));
  if (level === 'warning') return Math.max(0, Math.min(84, rawScore));
  return Math.max(0, Math.min(100, rawScore));
}

function getPostureTone(level: SecurityPostureLevel): SecurityDashboardTone {
  if (level === 'critical') return 'critical';
  if (level === 'warning') return 'warning';
  return 'success';
}

function buildRecommendationRows(
  recommendations: SecurityRecommendationSummary[],
  now: Date,
): SecurityRecommendationRow[] {
  return [...recommendations]
    .sort((a, b) => getSeverityRank(b.severity) - getSeverityRank(a.severity))
    .map((recommendation) => {
      const workflow = recommendation.workflow ?? { status: 'OPEN' };

      return {
        ...recommendation,
        severityLabel: getRecommendationSeverityLabel(recommendation.severity),
        typeLabel: getRecommendationTypeLabel(recommendation.type),
        auditFilters: recommendation.auditFilters ?? {},
        workflow,
        playbook: buildRecommendationPlaybook(recommendation, workflow, now),
      };
    });
}

function buildRecommendationPlaybook(
  recommendation: SecurityRecommendationSummary,
  workflow: SecurityRecommendationWorkflow,
  now: Date,
): SecurityRecommendationPlaybook {
  const slaHours = getRecommendationSlaHours(recommendation.severity);
  const dueAt = workflow.updatedAt
    ? addHoursIso(workflow.updatedAt, slaHours)
    : null;

  return {
    ownerLabel: getRecommendationOwnerLabel(recommendation.type),
    slaHours,
    dueAt,
    slaState: getRecommendationSlaState(workflow.status, dueAt, now),
    steps: buildRecommendationPlaybookSteps(workflow.status),
  };
}

function buildRecommendationPlaybookSteps(
  status: SecurityRecommendationWorkflow['status'],
): SecurityRecommendationPlaybookStep[] {
  const hasStarted = status !== 'OPEN';
  const hasReviewed = status === 'REVIEWED' || status === 'RESOLVED';
  const hasResolved = status === 'RESOLVED';

  return [
    {
      id: 'triage',
      label: 'Acknowledge and scope recommendation',
      evidenceHint: 'Capture the recommendation id, affected scope, and audit filters.',
      isComplete: hasStarted,
    },
    {
      id: 'investigate',
      label: 'Review supporting audit metadata',
      evidenceHint: 'Open the scoped audit deep link and verify metadata-only evidence.',
      isComplete: hasStarted,
    },
    {
      id: 'review',
      label: 'Record review decision',
      evidenceHint: 'Move workflow to REVIEWED with a short investigation note.',
      isComplete: hasReviewed,
    },
    {
      id: 'resolve',
      label: 'Close and export evidence packet',
      evidenceHint: 'Move workflow to RESOLVED and download the recommendation packet.',
      isComplete: hasResolved,
    },
  ];
}

function getRecommendationSlaHours(
  severity: SecurityRecommendationSummary['severity'],
): number {
  if (severity === 'critical') return 24;
  if (severity === 'warning') return 72;
  return 168;
}

function getRecommendationOwnerLabel(
  type: SecurityRecommendationSummary['type'],
): string {
  switch (type) {
    case 'AUDIT_CHAIN_REVIEW':
      return 'Compliance officer';
    case 'DLP_CLASSIFICATION_REVIEW':
      return 'DLP reviewer';
    case 'MALWARE_UPLOAD_REVIEW':
      return 'Security reviewer';
    case 'DOCUMENT_ACCESS_REVIEW':
      return 'Document owner';
    case 'ACTOR_ACCESS_REVIEW':
      return 'IAM reviewer';
  }
}

function getRecommendationSlaState(
  status: SecurityRecommendationWorkflow['status'],
  dueAt: string | null,
  now: Date,
): SecurityRecommendationSlaState {
  if (status === 'RESOLVED') return 'closed';
  if (!dueAt) return 'not-started';

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return 'not-started';
  if (dueDate.getTime() <= now.getTime()) return 'overdue';

  const dueSoonWindowMs = 24 * 60 * 60 * 1000;
  if (dueDate.getTime() - now.getTime() <= dueSoonWindowMs) {
    return 'due-soon';
  }

  return 'on-track';
}

function addHoursIso(timestamp: string, hours: number): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function normalizeNow(now?: string | Date): Date {
  const date = now ? new Date(now) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function getSeverityRank(
  severity: SecurityRecommendationSummary['severity'],
): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function getRecommendationSeverityLabel(
  severity: SecurityRecommendationSummary['severity'],
): string {
  if (severity === 'critical') return 'Critical';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}

function getRecommendationTypeLabel(
  type: SecurityRecommendationSummary['type'],
): string {
  switch (type) {
    case 'AUDIT_CHAIN_REVIEW':
      return 'Audit integrity';
    case 'DLP_CLASSIFICATION_REVIEW':
      return 'DLP classification';
    case 'MALWARE_UPLOAD_REVIEW':
      return 'Malware review';
    case 'DOCUMENT_ACCESS_REVIEW':
      return 'Document access';
    case 'ACTOR_ACCESS_REVIEW':
      return 'Actor activity';
  }
}

function getBehaviorSignalLabel(type: BehaviorSignalSummary['type']): string {
  switch (type) {
    case 'MASS_CONTENT_ACCESS':
      return 'Mass content access';
    case 'DENY_BURST':
      return 'Denied access burst';
    case 'DESTRUCTIVE_ACTIVITY':
      return 'Destructive activity';
  }
}

function buildRiskScoringRows(
  documents: RiskyDocumentSummary[],
): SecurityRiskScoringRow[] {
  return documents.map((document) => {
    const riskBand = getRiskBand(document.riskScore);

    return {
      ...document,
      riskBand,
      riskLabel: getRiskLabel(riskBand),
      auditFilters: { documentId: document.documentId },
    };
  });
}

function getRiskBand(riskScore: number): SecurityRiskBand {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 50) return 'warning';
  return 'watch';
}

function getRiskLabel(riskBand: SecurityRiskBand): string {
  if (riskBand === 'critical') return 'Critical risk';
  if (riskBand === 'warning') return 'Elevated risk';
  return 'Watch';
}

function toPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function buildPosture(
  summary: SecuritySummary | null | undefined,
  alerts: SecurityDashboardAlert[],
): SecurityDashboardModel['posture'] {
  if (alerts.some((alert) => alert.severity === 'critical')) {
    return {
      level: 'critical',
      label: 'Immediate review required',
      description: summary?.chain.message ?? 'A critical audit or security signal requires review.',
    };
  }

  if (alerts.length > 0) {
    return {
      level: 'warning',
      label: 'Security review needed',
      description: 'One or more security counters require compliance review.',
    };
  }

  return {
    level: 'healthy',
    label: 'Security posture healthy',
    description: 'No elevated security counters in the current audit summary.',
  };
}
