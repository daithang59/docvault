import type { AuditChainStatus, SecuritySummary } from '@/features/audit/audit.types';
import {
  buildAuditFilterQuery,
  buildSecurityDashboardModel,
  type SecurityRecommendationRow,
  type SecurityRecommendationSlaState,
} from '@/features/audit/security-dashboard';
import type {
  RetentionEvidenceResult,
  RetentionStatus,
} from '@/features/retention/retention.types';
import type {
  ComplianceEvidenceVersionDto,
  ComplianceEvidencePacket,
} from '@/features/documents/documents.types';
import type { ClassificationLevel, DocumentStatus } from '@/types/enums';

export type EvidenceSourceState = 'ready' | 'attention' | 'empty';

export const EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS = [
  'fileContent',
  'objectKey',
  'storagePath',
  'presignedUrl',
  'grantToken',
  'downloadToken',
] as const;

export interface EvidenceSourceCard {
  key: 'audit-chain' | 'recommendations' | 'retention' | 'document-packets';
  label: string;
  value: string;
  description: string;
  state: EvidenceSourceState;
}

export interface EvidenceRecommendationTarget {
  id: string;
  title: string;
  severity: SecurityRecommendationRow['severity'];
  workflowStatus: SecurityRecommendationRow['workflow']['status'];
  ownerLabel: string;
  slaState: SecurityRecommendationSlaState;
  auditQuery: string;
  affectedDocumentId: string | null;
  packetFilename: string;
}

export interface EvidenceDocumentPacketTarget {
  docId: string;
  title: string;
  status: DocumentStatus;
  classification: ClassificationLevel;
  retentionStatus: RetentionStatus;
  packetFilename: string;
}

export interface EvidenceCenterModel {
  generatedAt: string;
  auditChain: AuditChainStatus;
  sourceCards: EvidenceSourceCard[];
  recommendationTargets: EvidenceRecommendationTarget[];
  documentPacketTargets: EvidenceDocumentPacketTarget[];
  retentionSummary: RetentionEvidenceResult['summary'];
}

export interface EvidenceCenterManifest {
  generatedAt: string;
  metadataOnly: true;
  excludedSensitiveFields: string[];
  auditChain: AuditChainStatus;
  summary: {
    recommendations: number;
    documentPackets: number;
    retentionRecords: number;
    retentionDueSoon: number;
    retentionOverdue: number;
  };
  recommendationPacketIds: string[];
  documentPacketIds: string[];
}

export type EvidenceBundleChecklistId =
  | 'manifest'
  | 'audit-chain'
  | 'recommendation-packets'
  | 'document-packets'
  | 'retention-evidence';

export interface EvidenceBundleChecklistItem {
  id: EvidenceBundleChecklistId;
  label: string;
  complete: boolean;
  evidenceCount: number;
}

export interface EvidenceBundlePacketReference {
  id: string;
  title: string;
  packetFilename: string;
}

export interface EvidenceBundleRecommendationReference
  extends EvidenceBundlePacketReference {
  severity: SecurityRecommendationRow['severity'];
  workflowStatus: SecurityRecommendationRow['workflow']['status'];
  ownerLabel: string;
}

export interface EvidenceBundleDocumentReference
  extends EvidenceBundlePacketReference {
  status: DocumentStatus;
  classification: ClassificationLevel;
  retentionStatus: RetentionStatus;
}

export interface EvidenceBundleManifest {
  bundleId: string;
  bundleFilename: string;
  generatedAt: string;
  metadataOnly: true;
  excludedSensitiveFields: string[];
  auditChain: AuditChainStatus;
  summary: {
    recommendationPackets: number;
    documentPackets: number;
    totalPackets: number;
    missingSelections: number;
  };
  retentionSummary: RetentionEvidenceResult['summary'];
  packets: {
    recommendations: EvidenceBundleRecommendationReference[];
    documents: EvidenceBundleDocumentReference[];
  };
  checklist: EvidenceBundleChecklistItem[];
  missingSelectionIds: string[];
}

export interface EvidenceBundleSelection {
  selectedRecommendationIds: string[];
  selectedDocumentIds: string[];
  generatedAt?: string;
}

export interface EvidenceCenterDocumentPacket
  extends Omit<ComplianceEvidencePacket, 'versions'> {
  metadataOnly: true;
  excludedSensitiveFields: string[];
  versions: ComplianceEvidenceVersionDto[];
}

export function buildEvidenceCenterModel({
  securitySummary,
  retentionEvidence,
  generatedAt,
}: {
  securitySummary: SecuritySummary;
  retentionEvidence: RetentionEvidenceResult;
  generatedAt: string;
}): EvidenceCenterModel {
  const securityModel = buildSecurityDashboardModel(securitySummary, undefined, {
    now: generatedAt,
  });
  const recommendationTargets = securityModel.recommendations.items.map(
    buildRecommendationTarget,
  );
  const documentPacketTargets =
    retentionEvidence.records.map(buildDocumentPacketTarget);

  return {
    generatedAt,
    auditChain: securitySummary.chain,
    sourceCards: [
      {
        key: 'audit-chain',
        label: 'Audit Chain',
        value: String(securitySummary.chain.checked),
        description: securitySummary.chain.valid
          ? 'Hash-chain verification is available for audit exports.'
          : 'Hash-chain verification needs review before evidence export.',
        state: securitySummary.chain.valid ? 'ready' : 'attention',
      },
      {
        key: 'recommendations',
        label: 'Recommendation Packets',
        value: String(recommendationTargets.length),
        description:
          'Metadata-only recommendation packets with workflow history and playbook.',
        state: recommendationTargets.length > 0 ? 'attention' : 'empty',
      },
      {
        key: 'retention',
        label: 'Retention Evidence',
        value: String(retentionEvidence.summary.tracked),
        description:
          'Records lifecycle evidence, due-soon and overdue retention status.',
        state:
          retentionEvidence.summary.dueSoon > 0 ||
          retentionEvidence.summary.overdue > 0
            ? 'attention'
            : retentionEvidence.summary.tracked > 0
              ? 'ready'
              : 'empty',
      },
      {
        key: 'document-packets',
        label: 'Document Packets',
        value: String(documentPacketTargets.length),
        description:
          'Document compliance packet targets from retention evidence records.',
        state: documentPacketTargets.length > 0 ? 'ready' : 'empty',
      },
    ],
    recommendationTargets,
    documentPacketTargets,
    retentionSummary: retentionEvidence.summary,
  };
}

export function buildEvidenceCenterManifest(
  model: EvidenceCenterModel,
): EvidenceCenterManifest {
  return {
    generatedAt: model.generatedAt,
    metadataOnly: true,
    excludedSensitiveFields: [...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS],
    auditChain: model.auditChain,
    summary: {
      recommendations: model.recommendationTargets.length,
      documentPackets: model.documentPacketTargets.length,
      retentionRecords: model.retentionSummary.tracked,
      retentionDueSoon: model.retentionSummary.dueSoon,
      retentionOverdue: model.retentionSummary.overdue,
    },
    recommendationPacketIds: model.recommendationTargets.map((item) => item.id),
    documentPacketIds: model.documentPacketTargets.map((item) => item.docId),
  };
}

export function buildEvidenceBundle(
  model: EvidenceCenterModel,
  selection: EvidenceBundleSelection,
): EvidenceBundleManifest {
  const generatedAt = selection.generatedAt ?? model.generatedAt;
  const bundleId = `docvault-evidence-bundle-${timestampSlug(generatedAt)}`;
  const selectedRecommendationIds = new Set(selection.selectedRecommendationIds);
  const selectedDocumentIds = new Set(selection.selectedDocumentIds);

  const recommendations = model.recommendationTargets
    .filter((item) => selectedRecommendationIds.has(item.id))
    .map<EvidenceBundleRecommendationReference>((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      workflowStatus: item.workflowStatus,
      ownerLabel: item.ownerLabel,
      packetFilename: item.packetFilename,
    }));
  const documents = model.documentPacketTargets
    .filter((item) => selectedDocumentIds.has(item.docId))
    .map<EvidenceBundleDocumentReference>((item) => ({
      id: item.docId,
      title: item.title,
      status: item.status,
      classification: item.classification,
      retentionStatus: item.retentionStatus,
      packetFilename: item.packetFilename,
    }));

  const resolvedRecommendationIds = new Set(
    recommendations.map((item) => item.id),
  );
  const resolvedDocumentIds = new Set(documents.map((item) => item.id));
  const missingSelectionIds = [
    ...selection.selectedRecommendationIds.filter(
      (id) => !resolvedRecommendationIds.has(id),
    ),
    ...selection.selectedDocumentIds.filter((id) => !resolvedDocumentIds.has(id)),
  ];

  return {
    bundleId,
    bundleFilename: `${bundleId}.json`,
    generatedAt,
    metadataOnly: true,
    excludedSensitiveFields: [...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS],
    auditChain: model.auditChain,
    summary: {
      recommendationPackets: recommendations.length,
      documentPackets: documents.length,
      totalPackets: recommendations.length + documents.length,
      missingSelections: missingSelectionIds.length,
    },
    retentionSummary: model.retentionSummary,
    packets: {
      recommendations,
      documents,
    },
    checklist: [
      {
        id: 'manifest',
        label: 'Bundle manifest exported',
        complete: true,
        evidenceCount: recommendations.length + documents.length,
      },
      {
        id: 'audit-chain',
        label: 'Audit chain verified',
        complete: model.auditChain.valid,
        evidenceCount: model.auditChain.checked,
      },
      {
        id: 'recommendation-packets',
        label: 'Recommendation packets selected',
        complete:
          selection.selectedRecommendationIds.length > 0 &&
          recommendations.length === selection.selectedRecommendationIds.length,
        evidenceCount: recommendations.length,
      },
      {
        id: 'document-packets',
        label: 'Document packets selected',
        complete:
          selection.selectedDocumentIds.length > 0 &&
          documents.length === selection.selectedDocumentIds.length,
        evidenceCount: documents.length,
      },
      {
        id: 'retention-evidence',
        label: 'Retention evidence linked',
        complete: model.retentionSummary.tracked > 0,
        evidenceCount: model.retentionSummary.tracked,
      },
    ],
    missingSelectionIds,
  };
}

export function buildEvidenceCenterDocumentPacket(
  packet: ComplianceEvidencePacket,
): EvidenceCenterDocumentPacket {
  const sanitized = stripSensitiveEvidenceFields(packet) as Omit<
    ComplianceEvidencePacket,
    'versions'
  > & {
    versions: EvidenceCenterDocumentPacket['versions'];
  };

  return {
    ...sanitized,
    metadataOnly: true,
    excludedSensitiveFields: [...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS],
  };
}

function buildRecommendationTarget(
  recommendation: SecurityRecommendationRow,
): EvidenceRecommendationTarget {
  return {
    id: recommendation.id,
    title: recommendation.title,
    severity: recommendation.severity,
    workflowStatus: recommendation.workflow.status,
    ownerLabel: recommendation.playbook.ownerLabel,
    slaState: recommendation.playbook.slaState,
    auditQuery: buildAuditFilterQuery(recommendation.auditFilters),
    affectedDocumentId: recommendation.affectedDocumentIds[0] ?? null,
    packetFilename: `${slugify(recommendation.id)}-recommendation-evidence.json`,
  };
}

function buildDocumentPacketTarget(
  record: RetentionEvidenceResult['records'][number],
): EvidenceDocumentPacketTarget {
  return {
    docId: record.docId,
    title: record.title,
    status: record.status,
    classification: record.classification,
    retentionStatus: record.retentionStatus,
    packetFilename: `docvault-evidence-${slugify(record.title) || record.docId}.json`,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function timestampSlug(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return slugify(value) || 'manual';
  }

  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}

function stripSensitiveEvidenceFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveEvidenceFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, nestedValue]) => {
    if (isExcludedSensitiveField(key)) {
      return acc;
    }

    acc[key] = stripSensitiveEvidenceFields(nestedValue);
    return acc;
  }, {});
}

function isExcludedSensitiveField(key: string): boolean {
  return (EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS as readonly string[]).includes(
    key,
  );
}
