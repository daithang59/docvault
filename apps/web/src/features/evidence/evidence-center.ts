import type { AuditChainStatus, SecuritySummary } from '@/features/audit/audit.types';
import {
  buildAuditFilterQuery,
  buildSecurityDashboardModel,
  type SecurityRecommendationRow,
  type SecurityRecommendationSlaState,
} from '@/features/audit/security-dashboard';
import { ROUTES } from '@/lib/constants/routes';
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
export type EvidenceCommandCenterTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'critical';

export type UserDisplayNameMap = Record<
  string,
  { displayName: string; username: string }
>;

/**
 * Replace raw actor ids embedded in a server-built label with their resolved
 * display names. Used for display surfaces only — JSON packets keep raw ids so
 * evidence stays machine-verifiable.
 */
export function resolveActorIdsInText(
  text: string,
  actorIds: string[],
  displayNames?: UserDisplayNameMap,
): string {
  if (!displayNames || actorIds.length === 0) {
    return text;
  }

  let resolved = text;
  for (const actorId of actorIds) {
    const name = displayNames[actorId]?.displayName;
    if (name && resolved.includes(actorId)) {
      resolved = resolved.split(actorId).join(name);
    }
  }
  return resolved;
}

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

export interface EvidenceReadinessGauge {
  label: string;
  value: number;
  tone: EvidenceCommandCenterTone;
  description: string;
  href: string;
}

export interface EvidenceCommandMetric {
  key:
    | 'recommendation-packets'
    | 'document-packets'
    | 'retention-records'
    | 'audit-events';
  label: string;
  value: number;
  description: string;
  tone: EvidenceCommandCenterTone;
  href: string;
}

export interface EvidenceCommandSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  tone: EvidenceCommandCenterTone;
  href?: string;
}

export interface EvidenceCommandCenter {
  readinessGauge: EvidenceReadinessGauge;
  metrics: EvidenceCommandMetric[];
  sourceStateSegments: EvidenceCommandSegment[];
  packetTargetSegments: EvidenceCommandSegment[];
  retentionSegments: EvidenceCommandSegment[];
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
  affectedActorIds: string[];
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
  commandCenter: EvidenceCommandCenter;
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
  affectedActorIds: string[];
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

export type EvidenceCaseStatus = 'ready' | 'incomplete' | 'blocked';
export type EvidenceCaseSectionState = 'verified' | 'ready' | 'attention' | 'blocked';
export type EvidenceCaseSectionId = 'metadata' | 'workflow' | 'retention' | 'audit';

export interface EvidenceCaseAuditChain {
  state: 'verified' | 'blocked';
  label: string;
  checkedEvents: number;
}

export interface EvidenceCaseIntegrityBadge {
  state: EvidenceCaseAuditChain['state'];
  label: string;
  detail: string;
}

export interface EvidenceCaseRetentionPosture {
  state: 'ready' | 'attention' | 'blocked';
  label: string;
  tracked: number;
  dueSoon: number;
  overdue: number;
  archived: number;
}

export interface EvidenceCaseTimelineItem
  extends EvidenceBundleRecommendationReference {
  eventLabel: string;
  sequence: number;
}

export interface EvidenceCaseSectionItem {
  label: string;
  value: string;
}

export interface EvidenceCaseSection {
  id: EvidenceCaseSectionId;
  label: string;
  state: EvidenceCaseSectionState;
  summary: string;
  evidenceCount: number;
  items: EvidenceCaseSectionItem[];
}

export interface EvidenceCaseVisualTimelineItem {
  sequence: number;
  sectionId: EvidenceCaseSectionId;
  label: string;
  description: string;
  state: EvidenceCaseSectionState;
  evidenceCount: number;
}

export interface EvidenceCaseNarrative {
  caseId: string;
  generatedAt: string;
  status: EvidenceCaseStatus;
  headline: string;
  metadataOnly: true;
  excludedSensitiveFields: string[];
  auditChain: EvidenceCaseAuditChain;
  integrityBadge: EvidenceCaseIntegrityBadge;
  retentionPosture: EvidenceCaseRetentionPosture;
  sections: EvidenceCaseSection[];
  visualTimeline: EvidenceCaseVisualTimelineItem[];
  checklist: EvidenceBundleChecklistItem[];
  timeline: EvidenceCaseTimelineItem[];
  documents: EvidenceBundleDocumentReference[];
  warnings: string[];
  blockers: string[];
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
  const sourceCards = buildEvidenceSourceCards({
    auditChain: securitySummary.chain,
    recommendationTargets,
    retentionEvidence,
    documentPacketTargets,
  });

  return {
    generatedAt,
    auditChain: securitySummary.chain,
    commandCenter: buildEvidenceCommandCenter({
      auditChain: securitySummary.chain,
      sourceCards,
      recommendationTargets,
      documentPacketTargets,
      retentionSummary: retentionEvidence.summary,
    }),
    sourceCards,
    recommendationTargets,
    documentPacketTargets,
    retentionSummary: retentionEvidence.summary,
  };
}

function buildEvidenceSourceCards({
  auditChain,
  recommendationTargets,
  retentionEvidence,
  documentPacketTargets,
}: {
  auditChain: AuditChainStatus;
  recommendationTargets: EvidenceRecommendationTarget[];
  retentionEvidence: RetentionEvidenceResult;
  documentPacketTargets: EvidenceDocumentPacketTarget[];
}): EvidenceSourceCard[] {
  return [
    {
      key: 'audit-chain',
      label: 'Audit Chain',
      value: String(auditChain.checked),
      description: auditChain.valid
        ? 'Hash-chain verification is available for audit exports.'
        : 'Hash-chain verification needs review before evidence export.',
      state: auditChain.valid ? 'ready' : 'attention',
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
  ];
}

function buildEvidenceCommandCenter({
  auditChain,
  sourceCards,
  recommendationTargets,
  documentPacketTargets,
  retentionSummary,
}: {
  auditChain: AuditChainStatus;
  sourceCards: EvidenceSourceCard[];
  recommendationTargets: EvidenceRecommendationTarget[];
  documentPacketTargets: EvidenceDocumentPacketTarget[];
  retentionSummary: RetentionEvidenceResult['summary'];
}): EvidenceCommandCenter {
  const readySources = sourceCards.filter((card) => card.state === 'ready').length;
  const attentionSources = sourceCards.length - readySources;
  const readinessScore = Math.round(
    sourceCards.reduce((score, card) => score + sourceStateScore(card.state), 0) /
      Math.max(sourceCards.length, 1),
  );

  return {
    readinessGauge: {
      label: 'Evidence readiness',
      value: readinessScore,
      tone: getReadinessTone(readinessScore),
      description: `${readySources} of ${sourceCards.length} evidence sources are ready; ${attentionSources} need attention or source data.`,
      href: ROUTES.EVIDENCE,
    },
    metrics: [
      {
        key: 'recommendation-packets',
        label: 'Recommendation packets',
        value: recommendationTargets.length,
        description: 'Security recommendation packets available for export.',
        tone: sourceStateToneValue(
          sourceCards.find((card) => card.key === 'recommendations')?.state,
        ),
        href: '#recommendation-packets',
      },
      {
        key: 'document-packets',
        label: 'Document packets',
        value: documentPacketTargets.length,
        description: 'Document evidence packets from retention records.',
        tone: sourceStateToneValue(
          sourceCards.find((card) => card.key === 'document-packets')?.state,
        ),
        href: '#document-packets',
      },
      {
        key: 'retention-records',
        label: 'Retention records',
        value: retentionSummary.tracked,
        description: 'Tracked retention records included in evidence posture.',
        tone: sourceStateToneValue(
          sourceCards.find((card) => card.key === 'retention')?.state,
        ),
        href: ROUTES.RETENTION,
      },
      {
        key: 'audit-events',
        label: 'Audit events',
        value: auditChain.checked,
        description: 'Hash-chain checked events supporting evidence integrity.',
        tone: sourceStateToneValue(
          sourceCards.find((card) => card.key === 'audit-chain')?.state,
        ),
        href: ROUTES.AUDIT,
      },
    ],
    sourceStateSegments: buildSourceStateSegments(sourceCards),
    packetTargetSegments: buildPacketTargetSegments(
      recommendationTargets.length,
      documentPacketTargets.length,
    ),
    retentionSegments: buildRetentionSegments(retentionSummary),
  };
}

function buildSourceStateSegments(
  sourceCards: EvidenceSourceCard[],
): EvidenceCommandSegment[] {
  const counts = sourceCards.reduce<Record<EvidenceSourceState, number>>(
    (acc, card) => {
      acc[card.state] += 1;
      return acc;
    },
    { ready: 0, attention: 0, empty: 0 },
  );
  const total = sourceCards.length;

  return [
    {
      key: 'ready',
      label: 'Ready',
      value: counts.ready,
      percentage: toPercentage(counts.ready, total),
      tone: 'success',
    },
    {
      key: 'attention',
      label: 'Attention',
      value: counts.attention,
      percentage: toPercentage(counts.attention, total),
      tone: 'warning',
    },
    {
      key: 'empty',
      label: 'Empty',
      value: counts.empty,
      percentage: toPercentage(counts.empty, total),
      tone: 'info',
    },
  ];
}

function buildPacketTargetSegments(
  recommendationCount: number,
  documentCount: number,
): EvidenceCommandSegment[] {
  const total = recommendationCount + documentCount;

  return [
    {
      key: 'recommendations',
      label: 'Recommendations',
      value: recommendationCount,
      percentage: toPercentage(recommendationCount, total),
      tone: recommendationCount > 0 ? 'warning' : 'info',
      href: '#recommendation-packets',
    },
    {
      key: 'documents',
      label: 'Documents',
      value: documentCount,
      percentage: toPercentage(documentCount, total),
      tone: documentCount > 0 ? 'success' : 'info',
      href: '#document-packets',
    },
  ];
}

function buildRetentionSegments(
  summary: RetentionEvidenceResult['summary'],
): EvidenceCommandSegment[] {
  const total = summary.tracked;

  return [
    {
      key: 'active',
      label: 'Active',
      value: summary.active,
      percentage: toPercentage(summary.active, total),
      tone: 'success',
      href: ROUTES.RETENTION,
    },
    {
      key: 'due-soon',
      label: 'Due soon',
      value: summary.dueSoon,
      percentage: toPercentage(summary.dueSoon, total),
      tone: summary.dueSoon > 0 ? 'warning' : 'success',
      href: ROUTES.RETENTION,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: summary.overdue,
      percentage: toPercentage(summary.overdue, total),
      tone: summary.overdue > 0 ? 'critical' : 'success',
      href: ROUTES.RETENTION,
    },
    {
      key: 'archived',
      label: 'Archived',
      value: summary.archived,
      percentage: toPercentage(summary.archived, total),
      tone: 'info',
      href: ROUTES.RETENTION,
    },
  ];
}

function sourceStateScore(state: EvidenceSourceState): number {
  if (state === 'ready') return 100;
  if (state === 'attention') return 50;
  return 0;
}

function sourceStateToneValue(
  state: EvidenceSourceState | undefined,
): EvidenceCommandCenterTone {
  if (state === 'ready') return 'success';
  if (state === 'attention') return 'warning';
  return 'info';
}

function getReadinessTone(value: number): EvidenceCommandCenterTone {
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'critical';
}

function toPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
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
      affectedActorIds: item.affectedActorIds,
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

export function buildEvidenceCaseNarrative(
  bundle: EvidenceBundleManifest,
): EvidenceCaseNarrative {
  const retentionPosture = buildRetentionPosture(bundle.retentionSummary);
  const integrityBadge = buildIntegrityBadge(bundle.auditChain);
  const sections = buildEvidenceCaseSections(
    bundle,
    retentionPosture,
    integrityBadge,
  );
  const visualTimeline = buildEvidenceVisualTimeline(sections);
  const warnings = [
    ...bundle.missingSelectionIds.map((id) => `Missing selected packet: ${id}`),
  ];

  if (bundle.summary.recommendationPackets === 0) {
    warnings.push('No recommendation packet selected.');
  }
  if (bundle.summary.documentPackets === 0) {
    warnings.push('No document packet selected.');
  }

  const blockers = [
    ...(bundle.auditChain.valid
      ? []
      : [
          'Audit chain is not verified. Resolve tamper evidence before presenting this case.',
        ]),
    ...(retentionPosture.state === 'blocked'
      ? [
          'Retention evidence has overdue records. Resolve or explain retention exceptions before presenting this case.',
        ]
      : []),
  ];

  return {
    caseId: bundle.bundleId.toUpperCase(),
    generatedAt: bundle.generatedAt,
    status:
      blockers.length > 0
        ? 'blocked'
        : warnings.length > 0
          ? 'incomplete'
          : 'ready',
    headline: `Audit case with ${formatCount(
      bundle.summary.recommendationPackets,
      'recommendation packet',
    )} and ${formatCount(bundle.summary.documentPackets, 'document packet')}.`,
    metadataOnly: true,
    excludedSensitiveFields: [...bundle.excludedSensitiveFields],
    auditChain: {
      state: bundle.auditChain.valid ? 'verified' : 'blocked',
      label: bundle.auditChain.valid
        ? 'Audit chain verified'
        : 'Audit chain needs review',
      checkedEvents: bundle.auditChain.checked,
    },
    integrityBadge,
    retentionPosture,
    sections,
    visualTimeline,
    checklist: bundle.checklist.map((item) => ({ ...item })),
    timeline: bundle.packets.recommendations.map((item, index) => ({
      ...item,
      eventLabel: 'Recommendation packet selected',
      sequence: index + 1,
    })),
    documents: bundle.packets.documents.map((item) => ({ ...item })),
    warnings,
    blockers,
  };
}

function buildIntegrityBadge(
  auditChain: AuditChainStatus,
): EvidenceCaseIntegrityBadge {
  return {
    state: auditChain.valid ? 'verified' : 'blocked',
    label: auditChain.valid ? 'Audit chain valid' : 'Audit chain invalid',
    detail: `${formatCount(auditChain.checked, 'audit event')} checked`,
  };
}

function buildEvidenceCaseSections(
  bundle: EvidenceBundleManifest,
  retentionPosture: EvidenceCaseRetentionPosture,
  integrityBadge: EvidenceCaseIntegrityBadge,
): EvidenceCaseSection[] {
  return [
    {
      id: 'metadata',
      label: 'Metadata',
      state:
        bundle.summary.totalPackets > 0 && bundle.summary.missingSelections === 0
          ? 'verified'
          : 'attention',
      summary: `${formatCount(
        bundle.summary.totalPackets,
        'metadata-only packet',
      )} selected with ${formatCount(
        bundle.summary.missingSelections,
        'missing selection',
      )}.`,
      evidenceCount: bundle.summary.totalPackets,
      items: [
        { label: 'Bundle filename', value: bundle.bundleFilename },
        { label: 'Generated at', value: bundle.generatedAt },
        {
          label: 'Sensitive fields excluded',
          value: String(bundle.excludedSensitiveFields.length),
        },
      ],
    },
    {
      id: 'workflow',
      label: 'Workflow',
      state: bundle.summary.recommendationPackets > 0 ? 'verified' : 'attention',
      summary: `${formatCount(
        bundle.summary.recommendationPackets,
        'recommendation packet',
      )} linked with workflow status and owner context.`,
      evidenceCount: bundle.summary.recommendationPackets,
      items: [
        {
          label: 'Recommendation packets',
          value: String(bundle.summary.recommendationPackets),
        },
        {
          label: 'Document packets',
          value: String(bundle.summary.documentPackets),
        },
        {
          label: 'Workflow statuses',
          value: formatWorkflowStatuses(bundle.packets.recommendations),
        },
      ],
    },
    {
      id: 'retention',
      label: 'Retention',
      state:
        retentionPosture.state === 'ready'
          ? 'verified'
          : retentionPosture.state,
      summary: retentionPosture.label,
      evidenceCount: retentionPosture.tracked,
      items: [
        { label: 'Tracked', value: String(retentionPosture.tracked) },
        { label: 'Due soon', value: String(retentionPosture.dueSoon) },
        { label: 'Overdue', value: String(retentionPosture.overdue) },
        { label: 'Archived', value: String(retentionPosture.archived) },
      ],
    },
    {
      id: 'audit',
      label: 'Audit',
      state: integrityBadge.state,
      summary: integrityBadge.label,
      evidenceCount: bundle.auditChain.checked,
      items: [
        { label: 'Integrity', value: integrityBadge.label },
        { label: 'Checked events', value: String(bundle.auditChain.checked) },
        {
          label: 'Hash chain',
          value: bundle.auditChain.valid ? 'Valid' : 'Invalid',
        },
      ],
    },
  ];
}

function buildEvidenceVisualTimeline(
  sections: EvidenceCaseSection[],
): EvidenceCaseVisualTimelineItem[] {
  const timelineLabels: Record<EvidenceCaseSectionId, string> = {
    metadata: 'Metadata packet selected',
    workflow: 'Workflow evidence linked',
    retention: 'Retention posture checked',
    audit: 'Audit chain valid',
  };

  return sections.map((section, index) => ({
    sequence: index + 1,
    sectionId: section.id,
    label:
      section.id === 'audit' && section.state === 'blocked'
        ? 'Audit chain invalid'
        : timelineLabels[section.id],
    description: section.summary,
    state: section.state,
    evidenceCount: section.evidenceCount,
  }));
}

function formatWorkflowStatuses(
  recommendations: EvidenceBundleRecommendationReference[],
): string {
  if (recommendations.length === 0) {
    return 'None';
  }

  return [
    ...new Set(recommendations.map((item) => item.workflowStatus)),
  ].join(', ');
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
    affectedActorIds: recommendation.affectedActorIds,
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

function buildRetentionPosture(
  summary: RetentionEvidenceResult['summary'],
): EvidenceCaseRetentionPosture {
  if (summary.overdue > 0) {
    return {
      state: 'blocked',
      label: `${formatCount(summary.overdue, 'retention record')} overdue`,
      tracked: summary.tracked,
      dueSoon: summary.dueSoon,
      overdue: summary.overdue,
      archived: summary.archived,
    };
  }

  if (summary.dueSoon > 0) {
    return {
      state: 'attention',
      label: `${formatCount(summary.dueSoon, 'retention record')} due soon`,
      tracked: summary.tracked,
      dueSoon: summary.dueSoon,
      overdue: summary.overdue,
      archived: summary.archived,
    };
  }

  return {
    state: summary.tracked > 0 ? 'ready' : 'attention',
    label:
      summary.tracked > 0
        ? `${summary.tracked} retention record${summary.tracked === 1 ? '' : 's'} tracked`
        : 'No retention evidence linked',
    tracked: summary.tracked,
    dueSoon: summary.dueSoon,
    overdue: summary.overdue,
    archived: summary.archived,
  };
}

function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
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
