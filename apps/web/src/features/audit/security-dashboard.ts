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
export type SecurityAlertRoute = 'SIGNAL' | 'REVIEW' | 'CASE';

export interface SecurityAlertRoutingScore {
  impact: number;
  confidence: number;
  actionability: number;
  exposure: number;
  evidenceValue: number;
  total: number;
}

export interface SecurityAlertRouting {
  route: SecurityAlertRoute;
  routeLabel: string;
  routeDescription: string;
  rationale: string;
  score: SecurityAlertRoutingScore;
}

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
  routing: SecurityAlertRouting;
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
  eventTypeSegments: SecurityDashboardSegment[];
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

export type SecurityFindingCategory =
  | 'ACCESS_EXPOSURE'
  | 'SENSITIVE_DATA_CONTROL'
  | 'SUSPICIOUS_BEHAVIOR'
  | 'MALWARE_OBJECT_SAFETY'
  | 'AUDIT_INTEGRITY'
  | 'GOVERNANCE_SLA';

export interface SecurityRecommendationFinding {
  category: SecurityFindingCategory;
  categoryLabel: string;
  summary: string;
  affectedScopeLabel: string;
  evidenceQuestion: string;
  nextStepLabel: string;
  routing: SecurityAlertRouting;
}

export interface SecurityRecommendationRow
  extends Omit<SecurityRecommendationSummary, 'workflow'> {
  workflow: SecurityRecommendationWorkflow;
  playbook: SecurityRecommendationPlaybook;
  severityLabel: string;
  typeLabel: string;
  finding: SecurityRecommendationFinding;
  auditFilters: AuditQueryFilters;
}

export type SecurityRecommendationQueueView = 'active' | 'resolved' | 'all';

export const SECURITY_RECOMMENDATION_PREVIEW_LIMIT = 6;

export function filterSecurityRecommendationRows(
  items: SecurityRecommendationRow[],
  view: SecurityRecommendationQueueView,
): SecurityRecommendationRow[] {
  if (view === 'all') return items;
  if (view === 'resolved') {
    return items.filter((item) => item.workflow.status === 'RESOLVED');
  }
  return items.filter((item) => item.workflow.status !== 'RESOLVED');
}

export function getSecurityRecommendationQueueCounts(
  items: SecurityRecommendationRow[],
): Record<SecurityRecommendationQueueView, number> {
  const resolved = items.filter(
    (item) => item.workflow.status === 'RESOLVED',
  ).length;

  return {
    active: items.length - resolved,
    resolved,
    all: items.length,
  };
}

export function getSecurityRouteCounts(
  alerts: SecurityDashboardAlert[],
  recommendations: SecurityRecommendationRow[],
): Record<SecurityAlertRoute, number> {
  return [...alerts.map((alert) => alert.routing.route), ...recommendations.map(
    (recommendation) => recommendation.finding.routing.route,
  )].reduce<Record<SecurityAlertRoute, number>>(
    (acc, route) => {
      acc[route] += 1;
      return acc;
    },
    { SIGNAL: 0, REVIEW: 0, CASE: 0 },
  );
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
      routing: buildDashboardAlertRouting('AUDIT_CHAIN_INVALID'),
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
      routing: buildDashboardAlertRouting('HISTORICAL_AUDIT_EPOCH_COMPROMISED'),
    });
  }

  if (totals.malwareBlocked > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Malware upload blocked',
      description: `${totals.malwareBlocked} upload attempt${totals.malwareBlocked === 1 ? '' : 's'} were blocked before storage.`,
      action: 'Review the upload actor, checksum, and source document.',
      routing: buildDashboardAlertRouting('MALWARE_BLOCKED'),
    });
  }

  if (totals.dlpDetections > 0) {
    alerts.push({
      severity: 'warning',
      title: 'DLP detections recorded',
      description: `${totals.dlpDetections} DLP detection${totals.dlpDetections === 1 ? '' : 's'} require classification review.`,
      action: 'Confirm classification escalation and prevent unsafe downgrades.',
      routing: buildDashboardAlertRouting('DLP_DETECTED'),
    });
  }

  if ((summary?.repeatedDenyActors.length ?? 0) > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Repeated denied access',
      description: `${summary?.repeatedDenyActors.length ?? 0} actor${summary?.repeatedDenyActors.length === 1 ? '' : 's'} crossed the deny threshold.`,
      action: 'Review account activity',
      routing: buildDashboardAlertRouting('REPEATED_DENY'),
    });
  }

  if (downloadAuthorizedTotal >= 10) {
    alerts.push({
      severity: 'warning',
      title: 'High download volume',
      description: `${downloadAuthorizedTotal} successful download authorization${downloadAuthorizedTotal === 1 ? '' : 's'} are present in the audit window.`,
      action: 'Review high-volume document access before evidence export.',
      routing: buildDashboardAlertRouting('HIGH_DOWNLOAD_VOLUME'),
    });
  }

  if (sensitiveAccessEvents.length > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Sensitive document access',
      description: `${sensitiveAccessEvents.length} recent CONFIDENTIAL/SECRET preview or download event${sensitiveAccessEvents.length === 1 ? '' : 's'} need review.`,
      action: 'Confirm access intent, actor role, and document classification.',
      routing: buildDashboardAlertRouting('SENSITIVE_ACCESS'),
    });
  }

  if (riskyDocuments.some((document) => document.riskBand === 'critical')) {
    alerts.push({
      severity: 'warning',
      title: 'High-risk document activity',
      description: 'One or more sensitive documents have elevated access frequency or actor spread.',
      action: 'Review the risk scoring panel and open document-scoped audit evidence.',
      routing: buildDashboardAlertRouting('HIGH_RISK_DOCUMENT_ACTIVITY'),
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
      routing: buildDashboardAlertRouting(
        criticalSignals > 0
          ? 'CRITICAL_BEHAVIOR_ANOMALY'
          : 'BEHAVIOR_ANOMALY',
      ),
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
      totals,
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
  if (filters.actionGroup) params.set('actionGroup', filters.actionGroup);
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.resourceType) params.set('resourceType', filters.resourceType);
  if (filters.resourceId) params.set('resourceId', filters.resourceId);
  if (filters.documentId) params.set('documentId', filters.documentId);
  if (filters.aclId) params.set('aclId', filters.aclId);
  if (filters.recommendationId) {
    params.set('recommendationId', filters.recommendationId);
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

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
      auditFilters: getBehaviorSignalAuditFilters(signal),
    };
  });
}

function getBehaviorSignalAuditFilters(
  signal: BehaviorSignalSummary,
): AuditQueryFilters {
  const windowFilters = {
    actorId: signal.actorId,
    from: signal.windowStartedAt,
    to: signal.windowEndedAt,
  };

  if (signal.type === 'MASS_CONTENT_ACCESS') {
    return {
      ...windowFilters,
      actionGroup: 'AUTHORIZED_CONTENT_ACCESS',
    };
  }

  if (signal.type === 'DESTRUCTIVE_ACTIVITY') {
    return {
      ...windowFilters,
      actionGroup: 'DESTRUCTIVE_ACTIVITY',
    };
  }

  return {
    ...windowFilters,
    result: 'DENY',
  };
}

function buildCommandCenter({
  posture,
  alerts,
  riskScoringRows,
  behaviorSignalRows,
  recommendationRows,
  auditChain,
  totals,
  downloadAuthorizedTotal,
  sensitiveAccessCount,
}: {
  posture: SecurityDashboardModel['posture'];
  alerts: SecurityDashboardAlert[];
  riskScoringRows: SecurityRiskScoringRow[];
  behaviorSignalRows: SecurityBehaviorSignalRow[];
  recommendationRows: SecurityRecommendationRow[];
  auditChain?: AuditChainStatus;
  totals: SecuritySummary['totals'];
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
    eventTypeSegments: buildEventTypeSegments(totals),
    riskBandSegments: buildRiskBandSegments(riskScoringRows),
    anomalyBandSegments: buildAnomalyBandSegments(behaviorSignalRows),
    recommendationSlaSegments: buildRecommendationSlaSegments(recommendationRows),
    accessSegments: buildAccessSegments(
      downloadAuthorizedTotal,
      sensitiveAccessCount,
    ),
  };
}

function buildEventTypeSegments(
  totals: SecuritySummary['totals'],
): SecurityDashboardSegment[] {
  const total =
    totals.deniedEvents +
    totals.downloadDenied +
    totals.malwareBlocked +
    totals.dlpDetections;

  return [
    {
      key: 'denied-events',
      label: 'Denied events',
      value: totals.deniedEvents,
      percentage: toPercentage(totals.deniedEvents, total),
      tone: totals.deniedEvents > 0 ? 'warning' : 'success',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ result: 'DENY' })}`,
    },
    {
      key: 'download-denied',
      label: 'Download denied',
      value: totals.downloadDenied,
      percentage: toPercentage(totals.downloadDenied, total),
      tone: totals.downloadDenied > 0 ? 'warning' : 'success',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'DOCUMENT_DOWNLOAD_DENIED' })}`,
    },
    {
      key: 'malware-blocked',
      label: 'Malware blocked',
      value: totals.malwareBlocked,
      percentage: toPercentage(totals.malwareBlocked, total),
      tone: totals.malwareBlocked > 0 ? 'critical' : 'success',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'MALWARE_UPLOAD_BLOCKED' })}`,
    },
    {
      key: 'dlp-detections',
      label: 'DLP hits',
      value: totals.dlpDetections,
      percentage: toPercentage(totals.dlpDetections, total),
      tone: totals.dlpDetections > 0 ? 'warning' : 'success',
      href: `${ROUTES.AUDIT}?${buildAuditFilterQuery({ action: 'DLP_PATTERN_DETECTED' })}`,
    },
  ];
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
    .map((recommendation) => {
      const workflow = recommendation.workflow ?? { status: 'OPEN' };

      return {
        ...recommendation,
        severityLabel: getRecommendationSeverityLabel(recommendation.severity),
        typeLabel: getRecommendationTypeLabel(recommendation.type),
        finding: buildRecommendationFinding(recommendation),
        auditFilters: recommendation.auditFilters ?? {},
        workflow,
        playbook: buildRecommendationPlaybook(recommendation, workflow, now),
      };
    })
    .sort(
      (a, b) =>
        getRouteRank(b.finding.routing.route) -
          getRouteRank(a.finding.routing.route) ||
        getSeverityRank(b.severity) - getSeverityRank(a.severity),
    );
}

function buildRecommendationFinding(
  recommendation: SecurityRecommendationSummary,
): SecurityRecommendationFinding {
  return {
    ...getRecommendationFindingProfile(recommendation.type),
    affectedScopeLabel: buildAffectedScopeLabel(recommendation),
    routing: buildRecommendationRouting(recommendation),
  };
}

function getRecommendationFindingProfile(
  type: SecurityRecommendationSummary['type'],
): Omit<SecurityRecommendationFinding, 'affectedScopeLabel' | 'routing'> {
  switch (type) {
    case 'AUDIT_CHAIN_REVIEW':
      return {
        category: 'AUDIT_INTEGRITY',
        categoryLabel: 'Audit Integrity',
        summary: 'Audit evidence integrity needs review before export.',
        evidenceQuestion: 'Why was this raised?',
        nextStepLabel: 'Verify audit chain integrity',
      };
    case 'DLP_CLASSIFICATION_REVIEW':
      return {
        category: 'SENSITIVE_DATA_CONTROL',
        categoryLabel: 'Sensitive Data Control',
        summary: 'Sensitive data controls need classification review.',
        evidenceQuestion: 'Why was this raised?',
        nextStepLabel: 'Review classification controls',
      };
    case 'MALWARE_UPLOAD_REVIEW':
      return {
        category: 'MALWARE_OBJECT_SAFETY',
        categoryLabel: 'Malware/Object Safety',
        summary: 'Blocked upload needs source and object safety review.',
        evidenceQuestion: 'Why was this raised?',
        nextStepLabel: 'Review blocked upload context',
      };
    case 'DOCUMENT_ACCESS_REVIEW':
      return {
        category: 'ACCESS_EXPOSURE',
        categoryLabel: 'Access Exposure',
        summary: 'Sensitive document access needs review before evidence export.',
        evidenceQuestion: 'Why was this raised?',
        nextStepLabel: 'Review ACL and confirm business need',
      };
    case 'ACTOR_ACCESS_REVIEW':
      return {
        category: 'SUSPICIOUS_BEHAVIOR',
        categoryLabel: 'Suspicious Behavior',
        summary: 'Actor behavior needs investigation against audit evidence.',
        evidenceQuestion: 'Why was this raised?',
        nextStepLabel: 'Review actor activity and access path',
      };
  }
}

function buildAffectedScopeLabel(
  recommendation: SecurityRecommendationSummary,
): string {
  const documentCount = recommendation.affectedDocumentIds.length;
  const actorCount = recommendation.affectedActorIds.length;
  const parts: string[] = [];

  if (documentCount > 0) {
    parts.push(`${documentCount} ${pluralize(documentCount, 'document')}`);
  }

  if (actorCount > 0) {
    parts.push(`${actorCount} ${pluralize(actorCount, 'actor')}`);
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  const hasAuditFilter = Object.values(recommendation.auditFilters ?? {}).some(
    (value) => value !== undefined && value !== null && String(value).length > 0,
  );

  return hasAuditFilter ? 'Audit-filtered scope' : 'System-wide audit scope';
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

type DashboardAlertRoutingKind =
  | 'AUDIT_CHAIN_INVALID'
  | 'HISTORICAL_AUDIT_EPOCH_COMPROMISED'
  | 'MALWARE_BLOCKED'
  | 'DLP_DETECTED'
  | 'REPEATED_DENY'
  | 'HIGH_DOWNLOAD_VOLUME'
  | 'SENSITIVE_ACCESS'
  | 'HIGH_RISK_DOCUMENT_ACTIVITY'
  | 'CRITICAL_BEHAVIOR_ANOMALY'
  | 'BEHAVIOR_ANOMALY';

function buildRecommendationRouting(
  recommendation: SecurityRecommendationSummary,
): SecurityAlertRouting {
  switch (recommendation.type) {
    case 'AUDIT_CHAIN_REVIEW':
      return buildSecurityAlertRouting(
        {
          impact: 3,
          confidence: 3,
          actionability: 3,
          exposure: 3,
          evidenceValue: 3,
        },
        'Audit-chain integrity affects whether exported evidence can be trusted.',
      );
    case 'DOCUMENT_ACCESS_REVIEW':
      return buildSecurityAlertRouting(
        {
          impact: recommendation.severity === 'critical' ? 3 : 2,
          confidence: 3,
          actionability: 3,
          exposure: recommendation.affectedDocumentIds.length > 0 ? 3 : 2,
          evidenceValue: recommendation.severity === 'critical' ? 3 : 2,
        },
        recommendation.severity === 'critical'
          ? 'Critical sensitive-document exposure has concrete ACL remediation paths.'
          : 'Sensitive-document exposure needs owner review before heavier workflow.',
      );
    case 'ACTOR_ACCESS_REVIEW':
      return buildSecurityAlertRouting(
        {
          impact: recommendation.severity === 'critical' ? 3 : 2,
          confidence: recommendation.severity === 'critical' ? 2 : 2,
          actionability: recommendation.affectedActorIds.length > 0 ? 2 : 1,
          exposure: recommendation.affectedActorIds.length > 0 ? 3 : 1,
          evidenceValue: recommendation.severity === 'critical' ? 3 : 2,
        },
        recommendation.severity === 'critical'
          ? 'Critical actor behavior has a concrete actor scope and needs case ownership.'
          : 'Actor behavior needs review before escalating to a full case.',
      );
    case 'DLP_CLASSIFICATION_REVIEW':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: recommendation.affectedDocumentIds.length > 0 ? 2 : 1,
          evidenceValue: 2,
        },
        'DLP findings need classification review, but aggregate detections should not force a full case.',
      );
    case 'MALWARE_UPLOAD_REVIEW':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 3,
          actionability: 2,
          exposure:
            recommendation.affectedActorIds.length > 0 ||
            recommendation.affectedDocumentIds.length > 0
              ? 2
              : 1,
          evidenceValue: 2,
        },
        'Blocked malware uploads need review of source context before case escalation.',
      );
  }
}

function buildDashboardAlertRouting(
  kind: DashboardAlertRoutingKind,
): SecurityAlertRouting {
  switch (kind) {
    case 'AUDIT_CHAIN_INVALID':
      return buildSecurityAlertRouting(
        {
          impact: 3,
          confidence: 3,
          actionability: 3,
          exposure: 3,
          evidenceValue: 3,
        },
        'Current audit-chain integrity failure blocks trustworthy evidence export.',
      );
    case 'HISTORICAL_AUDIT_EPOCH_COMPROMISED':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 3,
          actionability: 2,
          exposure: 2,
          evidenceValue: 3,
        },
        'Historical evidence needs review, but the active chain remains valid.',
      );
    case 'MALWARE_BLOCKED':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 3,
          actionability: 2,
          exposure: 1,
          evidenceValue: 2,
        },
        'Blocked upload counters need review before a concrete actor or object case exists.',
      );
    case 'DLP_DETECTED':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: 1,
          evidenceValue: 2,
        },
        'Aggregate DLP detections need classification review without full case overhead.',
      );
    case 'REPEATED_DENY':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: 2,
          evidenceValue: 2,
        },
        'Repeated denies identify actors to review before granting or changing access.',
      );
    case 'HIGH_DOWNLOAD_VOLUME':
      return buildSecurityAlertRouting(
        {
          impact: 1,
          confidence: 2,
          actionability: 1,
          exposure: 1,
          evidenceValue: 1,
        },
        'Aggregate download volume is a trend signal until tied to a concrete risky subject.',
      );
    case 'SENSITIVE_ACCESS':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: 2,
          evidenceValue: 2,
        },
        'Sensitive access events need review against actor role and classification.',
      );
    case 'HIGH_RISK_DOCUMENT_ACTIVITY':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: 2,
          evidenceValue: 2,
        },
        'High-risk document activity needs review before deciding whether a case is required.',
      );
    case 'CRITICAL_BEHAVIOR_ANOMALY':
      return buildSecurityAlertRouting(
        {
          impact: 3,
          confidence: 2,
          actionability: 2,
          exposure: 3,
          evidenceValue: 3,
        },
        'Critical actor behavior has enough scope and evidence value for case ownership.',
      );
    case 'BEHAVIOR_ANOMALY':
      return buildSecurityAlertRouting(
        {
          impact: 2,
          confidence: 2,
          actionability: 2,
          exposure: 2,
          evidenceValue: 2,
        },
        'Behavior anomalies need review before escalating to a case.',
      );
  }
}

function buildSecurityAlertRouting(
  input: Omit<SecurityAlertRoutingScore, 'total'>,
  rationale: string,
): SecurityAlertRouting {
  const score: SecurityAlertRoutingScore = {
    ...input,
    total:
      input.impact +
      input.confidence +
      input.actionability +
      input.exposure +
      input.evidenceValue,
  };
  const route = inferSecurityAlertRoute(score);

  return {
    route,
    routeLabel: getSecurityAlertRouteLabel(route),
    routeDescription: getSecurityAlertRouteDescription(route),
    rationale,
    score,
  };
}

function inferSecurityAlertRoute(score: SecurityAlertRoutingScore): SecurityAlertRoute {
  if (
    score.impact >= 3 &&
    score.confidence >= 2 &&
    score.actionability >= 2 &&
    score.exposure >= 2 &&
    score.evidenceValue >= 3
  ) {
    return 'CASE';
  }

  if (score.total >= 8 || score.impact >= 2 || score.actionability >= 2) {
    return 'REVIEW';
  }

  return 'SIGNAL';
}

function getRouteRank(route: SecurityAlertRoute): number {
  if (route === 'CASE') return 3;
  if (route === 'REVIEW') return 2;
  return 1;
}

function getSecurityAlertRouteLabel(route: SecurityAlertRoute): string {
  if (route === 'CASE') return 'Case workflow required';
  if (route === 'REVIEW') return 'Lightweight review';
  return 'Monitor signal';
}

function getSecurityAlertRouteDescription(route: SecurityAlertRoute): string {
  if (route === 'CASE') {
    return 'Needs owner, SLA, investigation, remediation or accepted risk, verification, and evidence.';
  }

  if (route === 'REVIEW') {
    return 'Needs human review, but full case workflow would be too heavy.';
  }

  return 'Track as a trend or monitoring signal without workflow overhead.';
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
