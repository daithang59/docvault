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
  severityLabel: string;
  typeLabel: string;
  auditFilters: AuditQueryFilters;
}

export interface SecurityDashboardModel {
  posture: {
    level: SecurityPostureLevel;
    label: string;
    description: string;
  };
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
    workflowHistory,
  };
}

export function buildSecurityDashboardModel(
  summary: SecuritySummary | null | undefined,
  activity?: {
    downloadAuthorizedTotal?: number;
    sensitiveAccessEvents?: AuditLogEntry[];
  },
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
  );

  if (summary?.chain.valid === false) {
    alerts.push({
      severity: 'critical',
      title: 'Audit chain invalid',
      description: summary.chain.message ?? 'Hash-chain verification reported a broken audit chain.',
      action: 'Verify tamper evidence before trusting audit exports.',
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

  return {
    posture: buildPosture(summary, alerts),
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

function buildRecommendationRows(
  recommendations: SecurityRecommendationSummary[],
): SecurityRecommendationRow[] {
  return [...recommendations]
    .sort((a, b) => getSeverityRank(b.severity) - getSeverityRank(a.severity))
    .map((recommendation) => ({
      ...recommendation,
      severityLabel: getRecommendationSeverityLabel(recommendation.severity),
      typeLabel: getRecommendationTypeLabel(recommendation.type),
      auditFilters: recommendation.auditFilters ?? {},
      workflow: recommendation.workflow ?? { status: 'OPEN' },
    }));
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
