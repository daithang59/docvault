import { describe, expect, it } from 'vitest';
import type {
  AuditLogEntry,
  SecurityRecommendationSummary,
  SecurityRecommendationWorkflowStatus,
  SecuritySummary,
} from './audit.types';
import {
  buildAuditFilterQuery,
  buildRecommendationEvidencePacket,
  buildSecurityDashboardModel,
  filterSecurityRecommendationRows,
  getSecurityRecommendationQueueCounts,
  SECURITY_RECOMMENDATION_PREVIEW_LIMIT,
} from './security-dashboard';

function summary(overrides?: Partial<SecuritySummary>): SecuritySummary {
  return {
    chain: {
      valid: true,
      checked: 42,
    },
    totals: {
      deniedEvents: 0,
      malwareBlocked: 0,
      dlpDetections: 0,
      downloadDenied: 0,
    },
    repeatedDenyActors: [],
    riskyDocuments: [],
    behaviorSignals: [],
    recommendations: [],
    ...overrides,
  };
}

function auditEvent(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    eventId: overrides?.eventId ?? 'event-1',
    action: overrides?.action ?? 'DOCUMENT_PREVIEW_AUTHORIZED',
    actorId: overrides?.actorId ?? 'viewer-1',
    actorRoles: overrides?.actorRoles ?? ['viewer'],
    result: overrides?.result ?? 'SUCCESS',
    resourceType: overrides?.resourceType ?? 'DOCUMENT',
    resourceId: overrides?.resourceId ?? 'doc-1',
    timestamp: overrides?.timestamp ?? '2026-05-30T00:00:00.000Z',
    metadata: overrides?.metadata,
  };
}

function recommendationFixture(
  id: string,
  status: SecurityRecommendationWorkflowStatus,
): SecurityRecommendationSummary {
  return {
    id,
    type: 'ACTOR_ACCESS_REVIEW',
    severity: 'warning',
    title: id,
    reason: 'Test recommendation',
    recommendedAction: 'Review the audit evidence.',
    evidence: ['1 audit signal'],
    affectedDocumentIds: [],
    affectedActorIds: [],
    auditFilters: { actorId: 'actor-1' },
    workflow: { status },
  };
}

function recommendation(
  overrides: Partial<SecurityRecommendationSummary>,
): SecurityRecommendationSummary {
  return {
    id: overrides.id ?? 'recommendation:test',
    type: overrides.type ?? 'ACTOR_ACCESS_REVIEW',
    severity: overrides.severity ?? 'warning',
    title: overrides.title ?? 'Review test recommendation',
    reason: overrides.reason ?? 'Test recommendation',
    recommendedAction: overrides.recommendedAction ?? 'Review the audit evidence.',
    evidence: overrides.evidence ?? ['1 audit signal'],
    affectedDocumentIds: overrides.affectedDocumentIds ?? [],
    affectedActorIds: overrides.affectedActorIds ?? [],
    auditFilters: overrides.auditFilters ?? {},
    workflow: overrides.workflow ?? { status: 'OPEN' },
  };
}

describe('buildSecurityDashboardModel', () => {
  it('marks invalid audit chain as critical and first alert', () => {
    const model = buildSecurityDashboardModel(
      summary({
        chain: {
          valid: false,
          checked: 42,
          message: 'Hash mismatch at index 12',
        },
      }),
    );

    expect(model.posture.level).toBe('critical');
    expect(model.posture.label).toBe('Immediate review required');
    expect(model.alerts[0]).toMatchObject({
      severity: 'critical',
      title: 'Audit chain invalid',
      action: 'Verify tamper evidence before trusting audit exports.',
    });
  });

  it('warns when a historical audit epoch is compromised', () => {
    const model = buildSecurityDashboardModel(
      summary({
        chain: {
          valid: true,
          checked: 3,
          epochId: 'epoch-active',
          historicalCompromisedCount: 1,
          compromisedEpochs: [
            {
              epochId: 'epoch-old',
              status: 'COMPROMISED',
              incidentId: 'AUDIT-INC-1',
              firstBrokenIndex: 2,
            },
          ],
        },
      }),
    );

    expect(model.posture.level).toBe('warning');
    expect(model.alerts[0]).toMatchObject({
      severity: 'warning',
      title: 'Historical audit epoch compromised',
      description: '1 previous audit epoch is marked compromised.',
    });
  });

  it('raises warning alerts for malware, DLP, and repeated deny actors', () => {
    const model = buildSecurityDashboardModel(
      summary({
        totals: {
          deniedEvents: 7,
          malwareBlocked: 1,
          dlpDetections: 2,
          downloadDenied: 3,
        },
        repeatedDenyActors: [{ actorId: 'viewer-1', denyCount: 4 }],
      }),
    );

    expect(model.posture.level).toBe('warning');
    expect(model.alerts.map((alert) => alert.title)).toEqual([
      'Malware upload blocked',
      'DLP detections recorded',
      'Repeated denied access',
    ]);
    expect(model.repeatedDenyActors[0]).toEqual({
      actorId: 'viewer-1',
      denyCount: 4,
      riskLabel: 'Review account activity',
    });
  });

  it('raises warning alerts for high download volume and sensitive content access', () => {
    const model = buildSecurityDashboardModel(summary(), {
      downloadAuthorizedTotal: 12,
      sensitiveAccessEvents: [
        auditEvent({
          eventId: 'event-secret',
          metadata: { classification: 'SECRET' },
        }),
      ],
    });

    expect(model.activity).toMatchObject({
      downloadAuthorizedTotal: 12,
      sensitiveAccessCount: 1,
    });
    expect(model.alerts.map((alert) => alert.title)).toEqual([
      'High download volume',
      'Sensitive document access',
    ]);
  });

  it('returns healthy posture when no security counters are raised', () => {
    const model = buildSecurityDashboardModel(summary());

    expect(model.posture).toEqual({
      level: 'healthy',
      label: 'Security posture healthy',
      description: 'No elevated security counters in the current audit summary.',
    });
    expect(model.alerts).toEqual([]);
    expect(model.riskScoring.riskyDocuments).toEqual([]);
  });

  it('exposes risk scoring rows with audit deep links', () => {
    const model = buildSecurityDashboardModel(
      summary({
        riskyDocuments: [
          {
            documentId: 'doc-secret',
            classification: 'SECRET',
            accessCount: 4,
            actorCount: 2,
            latestAccessAt: '2026-05-30T10:15:00.000Z',
            riskScore: 95,
            reasons: [
              'SECRET classification',
              '4 successful preview/download grants',
              '2 distinct actors',
              '2 download grants',
            ],
          },
        ],
      }),
    );

    expect(model.riskScoring.riskyDocuments[0]).toMatchObject({
      documentId: 'doc-secret',
      classification: 'SECRET',
      accessCount: 4,
      actorCount: 2,
      riskScore: 95,
      riskBand: 'critical',
      auditFilters: { documentId: 'doc-secret' },
    });
    expect(
      buildAuditFilterQuery(model.riskScoring.riskyDocuments[0].auditFilters),
    ).toBe('documentId=doc-secret');
  });

  it('exposes behavior anomaly rows with signal-scoped audit deep links', () => {
    const model = buildSecurityDashboardModel(
      summary({
        behaviorSignals: [
          {
            signalId: 'MASS_CONTENT_ACCESS:editor-1',
            type: 'MASS_CONTENT_ACCESS',
            severity: 'critical',
            actorId: 'editor-1',
            actionCount: 5,
            documentCount: 5,
            windowStartedAt: '2026-05-30T10:00:00.000Z',
            windowEndedAt: '2026-05-30T10:08:00.000Z',
            riskScore: 100,
            reasons: [
              '5 successful preview/download grants',
              '5 distinct documents',
              '3 sensitive document grants',
            ],
          },
        ],
      }),
    );

    expect(model.behaviorAnomalies.signals[0]).toMatchObject({
      signalId: 'MASS_CONTENT_ACCESS:editor-1',
      typeLabel: 'Mass content access',
      riskBand: 'critical',
      riskLabel: 'Critical risk',
      auditFilters: {
        actorId: 'editor-1',
        actionGroup: 'AUTHORIZED_CONTENT_ACCESS',
        from: '2026-05-30T10:00:00.000Z',
        to: '2026-05-30T10:08:00.000Z',
      },
    });
    expect(model.alerts.map((alert) => alert.title)).toContain(
      'Behavior anomaly detected',
    );
    expect(
      buildAuditFilterQuery(model.behaviorAnomalies.signals[0].auditFilters),
    ).toBe(
      'actionGroup=AUTHORIZED_CONTENT_ACCESS&actorId=editor-1&from=2026-05-30T10%3A00%3A00.000Z&to=2026-05-30T10%3A08%3A00.000Z',
    );
  });

  it('builds command-center presentation data for security visuals', () => {
    const model = buildSecurityDashboardModel(
      summary({
        totals: {
          deniedEvents: 7,
          downloadDenied: 3,
          malwareBlocked: 1,
          dlpDetections: 2,
        },
        riskyDocuments: [
          {
            documentId: 'doc-critical',
            classification: 'SECRET',
            accessCount: 5,
            actorCount: 3,
            latestAccessAt: '2026-06-01T10:00:00.000Z',
            riskScore: 95,
            reasons: ['SECRET classification'],
          },
          {
            documentId: 'doc-warning',
            classification: 'CONFIDENTIAL',
            accessCount: 3,
            actorCount: 2,
            latestAccessAt: '2026-06-01T09:00:00.000Z',
            riskScore: 65,
            reasons: ['CONFIDENTIAL classification'],
          },
          {
            documentId: 'doc-watch',
            classification: 'INTERNAL',
            accessCount: 1,
            actorCount: 1,
            latestAccessAt: '2026-06-01T08:00:00.000Z',
            riskScore: 25,
            reasons: ['Recent access'],
          },
        ],
        behaviorSignals: [
          {
            signalId: 'MASS_CONTENT_ACCESS:editor-1',
            type: 'MASS_CONTENT_ACCESS',
            severity: 'critical',
            actorId: 'editor-1',
            actionCount: 5,
            documentCount: 5,
            windowStartedAt: '2026-06-01T10:00:00.000Z',
            windowEndedAt: '2026-06-01T10:08:00.000Z',
            riskScore: 100,
            reasons: ['5 successful grants'],
          },
          {
            signalId: 'DENY_BURST:viewer-1',
            type: 'DENY_BURST',
            severity: 'warning',
            actorId: 'viewer-1',
            actionCount: 3,
            documentCount: 2,
            windowStartedAt: '2026-06-01T09:00:00.000Z',
            windowEndedAt: '2026-06-01T09:15:00.000Z',
            riskScore: 58,
            reasons: ['3 denied security events'],
          },
          {
            signalId: 'DESTRUCTIVE_ACTIVITY:editor-2',
            type: 'DESTRUCTIVE_ACTIVITY',
            severity: 'watch',
            actorId: 'editor-2',
            actionCount: 1,
            documentCount: 1,
            windowStartedAt: '2026-06-01T08:00:00.000Z',
            windowEndedAt: '2026-06-01T08:05:00.000Z',
            riskScore: 35,
            reasons: ['Deletion event'],
          },
        ],
        recommendations: [
          {
            id: 'document-access-review:doc-critical',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'critical',
            title: 'Tighten access for high-risk SECRET document',
            reason: 'Document reached critical risk score.',
            recommendedAction: 'Review ACLs.',
            evidence: ['SECRET classification'],
            affectedDocumentIds: ['doc-critical'],
            affectedActorIds: [],
            auditFilters: { documentId: 'doc-critical' },
            workflow: {
              status: 'INVESTIGATING',
              updatedAt: '2026-06-01T10:00:00.000Z',
            },
          },
          {
            id: 'actor-access-review:DENY_BURST:viewer-1',
            type: 'ACTOR_ACCESS_REVIEW',
            severity: 'warning',
            title: 'Investigate denied access burst',
            reason: 'Actor triggered deny burst.',
            recommendedAction: 'Inspect role membership.',
            evidence: ['3 denied security events'],
            affectedDocumentIds: [],
            affectedActorIds: ['viewer-1'],
            auditFilters: { actorId: 'viewer-1' },
            workflow: {
              status: 'INVESTIGATING',
              updatedAt: '2026-06-01T10:00:00.000Z',
            },
          },
          {
            id: 'dlp-classification-review',
            type: 'DLP_CLASSIFICATION_REVIEW',
            severity: 'info',
            title: 'Review DLP-driven classification controls',
            reason: 'DLP signal needs confirmation.',
            recommendedAction: 'Confirm classification escalation.',
            evidence: ['DLP detection event'],
            affectedDocumentIds: [],
            affectedActorIds: [],
            auditFilters: { action: 'DLP_PATTERN_DETECTED' },
            workflow: { status: 'RESOLVED' },
          },
        ],
      }),
      {
        downloadAuthorizedTotal: 8,
        sensitiveAccessEvents: [
          auditEvent({
            eventId: 'event-secret-download',
            action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
            metadata: { classification: 'SECRET' },
          }),
          auditEvent({
            eventId: 'event-confidential-preview',
            action: 'DOCUMENT_PREVIEW_AUTHORIZED',
            metadata: { classification: 'CONFIDENTIAL' },
          }),
        ],
      },
      { now: '2026-06-02T11:00:00.000Z' },
    );
    const { commandCenter } = model;

    expect(commandCenter.postureGauge).toMatchObject({
      label: 'Security posture',
      value: 43,
      tone: 'critical',
    });
    expect(commandCenter.alertSegments).toEqual([
      expect.objectContaining({ key: 'critical', value: 1, percentage: 20 }),
      expect.objectContaining({ key: 'warning', value: 4, percentage: 80 }),
      expect.objectContaining({ key: 'info', value: 0, percentage: 0 }),
    ]);
    expect(commandCenter.eventTypeSegments).toEqual([
      expect.objectContaining({ key: 'denied-events', value: 7, percentage: 54 }),
      expect.objectContaining({ key: 'download-denied', value: 3, percentage: 23 }),
      expect.objectContaining({ key: 'malware-blocked', value: 1, percentage: 8 }),
      expect.objectContaining({ key: 'dlp-detections', value: 2, percentage: 15 }),
    ]);
    expect(commandCenter.riskBandSegments).toEqual([
      expect.objectContaining({ key: 'critical', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'warning', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'watch', value: 1, percentage: 33 }),
    ]);
    expect(commandCenter.anomalyBandSegments).toEqual([
      expect.objectContaining({ key: 'critical', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'warning', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'watch', value: 1, percentage: 33 }),
    ]);
    expect(commandCenter.recommendationSlaSegments).toEqual([
      expect.objectContaining({ key: 'overdue', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'due-soon', value: 0, percentage: 0 }),
      expect.objectContaining({ key: 'on-track', value: 1, percentage: 33 }),
      expect.objectContaining({ key: 'not-started', value: 0, percentage: 0 }),
      expect.objectContaining({ key: 'closed', value: 1, percentage: 33 }),
    ]);
    expect(commandCenter.accessSegments).toEqual([
      expect.objectContaining({
        key: 'download-authorized',
        value: 8,
        percentage: 100,
      }),
      expect.objectContaining({
        key: 'sensitive-access',
        value: 2,
        percentage: 25,
      }),
    ]);
  });

  it('exposes prioritized security recommendations with audit deep links', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          {
            id: 'document-access-review:doc-secret',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'critical',
            title: 'Tighten access for high-risk SECRET document',
            reason:
              'Document doc-secret reached risk score 95 from classification and access metadata.',
            recommendedAction:
              'Review ACLs, confirm business need for recent grants, and keep watermark-required delivery for sensitive content.',
            evidence: [
              'SECRET classification',
              '4 successful preview/download grants',
            ],
            affectedDocumentIds: ['doc-secret'],
            affectedActorIds: [],
            auditFilters: { documentId: 'doc-secret' },
            workflow: {
              status: 'INVESTIGATING',
              note: 'Checking ACL evidence',
              updatedAt: '2026-05-31T11:00:00.000Z',
              updatedBy: 'co1',
            },
          },
          {
            id: 'actor-access-review:DENY_BURST:viewer-1',
            type: 'ACTOR_ACCESS_REVIEW',
            severity: 'warning',
            title: 'Investigate denied access burst for viewer-1',
            reason:
              'Actor viewer-1 triggered DENY_BURST with score 58 across 3 document(s).',
            recommendedAction:
              'Inspect role, group membership, and ACL assignments before broadening access.',
            evidence: ['3 denied security events'],
            affectedDocumentIds: [],
            affectedActorIds: ['viewer-1'],
            auditFilters: { actorId: 'viewer-1' },
            workflow: { status: 'OPEN' },
          },
        ],
      }),
    );

    expect(model.recommendations.items).toEqual([
      expect.objectContaining({
        id: 'document-access-review:doc-secret',
        severity: 'critical',
        severityLabel: 'Critical',
        auditFilters: { documentId: 'doc-secret' },
        workflow: {
          status: 'INVESTIGATING',
          note: 'Checking ACL evidence',
          updatedAt: '2026-05-31T11:00:00.000Z',
          updatedBy: 'co1',
        },
      }),
      expect.objectContaining({
        id: 'actor-access-review:DENY_BURST:viewer-1',
        severity: 'warning',
        severityLabel: 'Warning',
        auditFilters: { actorId: 'viewer-1' },
        workflow: { status: 'OPEN' },
      }),
    ]);
    expect(
      buildAuditFilterQuery(model.recommendations.items[0].auditFilters),
    ).toBe('documentId=doc-secret');
  });

  it('returns empty behavior anomaly rows when summary has no behavior signals', () => {
    const model = buildSecurityDashboardModel(summary());

    expect(model.behaviorAnomalies.signals).toEqual([]);
  });

  it('defaults recommendation workflow to open when the backend omits it', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          {
            id: 'malware-upload-review',
            type: 'MALWARE_UPLOAD_REVIEW',
            severity: 'warning',
            title: 'Review blocked malware upload attempts',
            reason: '1 malware upload attempt was blocked before object storage.',
            recommendedAction:
              'Review source actor, checksum, filename, and endpoint context for the blocked upload.',
            evidence: ['1 malware upload blocked'],
            affectedDocumentIds: [],
            affectedActorIds: [],
            auditFilters: { action: 'MALWARE_UPLOAD_BLOCKED' },
          },
        ],
      }),
    );

    expect(model.recommendations.items[0].workflow).toEqual({ status: 'OPEN' });
  });

  it('filters security recommendations by active, resolved, and all queue views', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          recommendationFixture('open-rec', 'OPEN'),
          recommendationFixture('investigating-rec', 'INVESTIGATING'),
          recommendationFixture('reviewed-rec', 'REVIEWED'),
          recommendationFixture('resolved-rec', 'RESOLVED'),
        ],
      }),
    );

    expect(
      filterSecurityRecommendationRows(model.recommendations.items, 'active').map(
        (item) => item.id,
      ),
    ).toEqual(['open-rec', 'investigating-rec', 'reviewed-rec']);
    expect(
      filterSecurityRecommendationRows(
        model.recommendations.items,
        'resolved',
      ).map((item) => item.id),
    ).toEqual(['resolved-rec']);
    expect(
      filterSecurityRecommendationRows(model.recommendations.items, 'all').map(
        (item) => item.id,
      ),
    ).toEqual([
      'open-rec',
      'investigating-rec',
      'reviewed-rec',
      'resolved-rec',
    ]);
  });

  it('counts security recommendation queue views', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          recommendationFixture('open-rec', 'OPEN'),
          recommendationFixture('reviewed-rec', 'REVIEWED'),
          recommendationFixture('resolved-rec', 'RESOLVED'),
        ],
      }),
    );

    expect(
      getSecurityRecommendationQueueCounts(model.recommendations.items),
    ).toEqual({
      active: 2,
      resolved: 1,
      all: 3,
    });
  });

  it('exports the security recommendation preview limit', () => {
    expect(SECURITY_RECOMMENDATION_PREVIEW_LIMIT).toBe(6);
  });

  it('attaches a deterministic playbook with owner, SLA, and checklist progress', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          {
            id: 'document-access-review:doc-secret',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'critical',
            title: 'Tighten access for high-risk SECRET document',
            reason:
              'Document doc-secret reached risk score 95 from classification and access metadata.',
            recommendedAction:
              'Review ACLs, confirm business need for recent grants, and keep watermark-required delivery for sensitive content.',
            evidence: ['SECRET classification'],
            affectedDocumentIds: ['doc-secret'],
            affectedActorIds: [],
            auditFilters: { documentId: 'doc-secret' },
            workflow: {
              status: 'INVESTIGATING',
              updatedAt: '2026-06-01T10:00:00.000Z',
              updatedBy: 'co1',
            },
          },
        ],
      }),
      undefined,
      { now: '2026-06-02T08:30:00.000Z' },
    );

    expect(model.recommendations.items[0].playbook).toEqual({
      ownerLabel: 'Document owner',
      slaHours: 24,
      dueAt: '2026-06-02T10:00:00.000Z',
      slaState: 'due-soon',
      steps: [
        {
          id: 'triage',
          label: 'Acknowledge and scope recommendation',
          evidenceHint: 'Capture the recommendation id, affected scope, and audit filters.',
          isComplete: true,
        },
        {
          id: 'investigate',
          label: 'Review supporting audit metadata',
          evidenceHint: 'Open the scoped audit deep link and verify metadata-only evidence.',
          isComplete: true,
        },
        {
          id: 'review',
          label: 'Record review decision',
          evidenceHint: 'Move workflow to REVIEWED with a short investigation note.',
          isComplete: false,
        },
        {
          id: 'resolve',
          label: 'Close and export evidence packet',
          evidenceHint: 'Move workflow to RESOLVED and download the recommendation packet.',
          isComplete: false,
        },
      ],
    });
  });

  it('attaches evidence-backed finding metadata to access exposure recommendations', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          {
            id: 'document-access-review:doc-secret',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'critical',
            title: 'Tighten access for high-risk SECRET document',
            reason:
              'Document doc-secret reached risk score 95 from classification and access metadata.',
            recommendedAction:
              'Review ACLs, confirm business need for recent grants, and keep watermark-required delivery for sensitive content.',
            evidence: ['SECRET classification', 'ALLOW DOWNLOAD for viewer-1'],
            affectedDocumentIds: ['doc-secret'],
            affectedActorIds: ['viewer-1'],
            auditFilters: { documentId: 'doc-secret' },
            workflow: { status: 'OPEN' },
          },
        ],
      }),
    );

    expect(model.recommendations.items[0].finding).toMatchObject({
      category: 'ACCESS_EXPOSURE',
      categoryLabel: 'Access Exposure',
      summary: 'Sensitive document access needs review before evidence export.',
      affectedScopeLabel: '1 document · 1 actor',
      evidenceQuestion: 'Why was this raised?',
      nextStepLabel: 'Review ACL and confirm business need',
      routing: {
        route: 'CASE',
        routeLabel: 'Case workflow required',
      },
    });
  });

  it('maps every recommendation type to a stable warning category', () => {
    const recommendationTypes: Array<
      [SecurityRecommendationSummary['type'], string, string]
    > = [
      ['AUDIT_CHAIN_REVIEW', 'AUDIT_INTEGRITY', 'Audit Integrity'],
      ['DLP_CLASSIFICATION_REVIEW', 'SENSITIVE_DATA_CONTROL', 'Sensitive Data Control'],
      ['MALWARE_UPLOAD_REVIEW', 'MALWARE_OBJECT_SAFETY', 'Malware/Object Safety'],
      ['DOCUMENT_ACCESS_REVIEW', 'ACCESS_EXPOSURE', 'Access Exposure'],
      ['ACTOR_ACCESS_REVIEW', 'SUSPICIOUS_BEHAVIOR', 'Suspicious Behavior'],
    ];

    const model = buildSecurityDashboardModel(
      summary({
        recommendations: recommendationTypes.map(([type]) => ({
          id: `recommendation:${type}`,
          type,
          severity: 'warning',
          title: `Review ${type}`,
          reason: 'Test recommendation',
          recommendedAction: 'Review the audit evidence.',
          evidence: ['1 audit signal'],
          affectedDocumentIds: [],
          affectedActorIds: [],
          auditFilters: {},
          workflow: { status: 'OPEN' },
        })),
      }),
    );

    expect(
      model.recommendations.items.map((item) => [
        item.type,
        item.finding.category,
        item.finding.categoryLabel,
      ]),
    ).toEqual(recommendationTypes);
  });

  it('routes audit integrity and critical access exposure findings to case workflow', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          recommendation({
            id: 'audit-chain-review',
            type: 'AUDIT_CHAIN_REVIEW',
            severity: 'critical',
            auditFilters: {},
          }),
          recommendation({
            id: 'document-access-review:doc-secret',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'critical',
            affectedDocumentIds: ['doc-secret'],
            auditFilters: { documentId: 'doc-secret' },
          }),
        ],
      }),
    );

    expect(
      model.recommendations.items.map((item) => [
        item.id,
        item.finding.routing.route,
        item.finding.routing.routeLabel,
      ]),
    ).toEqual([
      ['audit-chain-review', 'CASE', 'Case workflow required'],
      [
        'document-access-review:doc-secret',
        'CASE',
        'Case workflow required',
      ],
    ]);
  });

  it('routes warning access exposure and aggregate control findings to lightweight review', () => {
    const model = buildSecurityDashboardModel(
      summary({
        recommendations: [
          recommendation({
            id: 'document-access-review:doc-internal',
            type: 'DOCUMENT_ACCESS_REVIEW',
            severity: 'warning',
            affectedDocumentIds: ['doc-internal'],
            auditFilters: { documentId: 'doc-internal' },
          }),
          recommendation({
            id: 'dlp-classification-review',
            type: 'DLP_CLASSIFICATION_REVIEW',
            severity: 'warning',
            affectedDocumentIds: [],
            affectedActorIds: [],
            auditFilters: { action: 'DLP_PATTERN_DETECTED' },
          }),
          recommendation({
            id: 'malware-upload-review',
            type: 'MALWARE_UPLOAD_REVIEW',
            severity: 'warning',
            affectedDocumentIds: [],
            affectedActorIds: [],
            auditFilters: { action: 'MALWARE_UPLOAD_BLOCKED' },
          }),
        ],
      }),
    );

    expect(
      model.recommendations.items.map((item) => [
        item.id,
        item.finding.routing.route,
        item.finding.routing.routeLabel,
      ]),
    ).toEqual([
      [
        'document-access-review:doc-internal',
        'REVIEW',
        'Lightweight review',
      ],
      ['dlp-classification-review', 'REVIEW', 'Lightweight review'],
      ['malware-upload-review', 'REVIEW', 'Lightweight review'],
    ]);
  });

  it('routes high download volume dashboard alerts to monitor signal', () => {
    const model = buildSecurityDashboardModel(summary(), {
      downloadAuthorizedTotal: 12,
    });

    expect(model.alerts).toContainEqual(
      expect.objectContaining({
        title: 'High download volume',
        routing: expect.objectContaining({
          route: 'SIGNAL',
          routeLabel: 'Monitor signal',
        }),
      }),
    );
  });

  it('routes critical actor behavior with affected scope to case workflow', () => {
    const model = buildSecurityDashboardModel(
      summary({
        behaviorSignals: [
          {
            signalId: 'MASS_CONTENT_ACCESS:editor-1',
            type: 'MASS_CONTENT_ACCESS',
            severity: 'critical',
            actorId: 'editor-1',
            actionCount: 18,
            documentCount: 7,
            windowStartedAt: '2026-05-30T10:00:00.000Z',
            windowEndedAt: '2026-05-30T10:08:00.000Z',
            riskScore: 92,
            reasons: ['18 content access events in 8 minutes'],
          },
        ],
        recommendations: [
          recommendation({
            id: 'actor-access-review:MASS_CONTENT_ACCESS:editor-1',
            type: 'ACTOR_ACCESS_REVIEW',
            severity: 'critical',
            affectedActorIds: ['editor-1'],
            auditFilters: {
              actorId: 'editor-1',
              actionGroup: 'AUTHORIZED_CONTENT_ACCESS',
            },
          }),
        ],
      }),
    );

    expect(model.alerts).toContainEqual(
      expect.objectContaining({
        title: 'Behavior anomaly detected',
        routing: expect.objectContaining({
          route: 'CASE',
          routeLabel: 'Case workflow required',
        }),
      }),
    );
    expect(model.recommendations.items[0].finding.routing).toMatchObject({
      route: 'CASE',
      routeLabel: 'Case workflow required',
    });
  });

  it('defines quick investigation filters for the required security event classes', () => {
    const model = buildSecurityDashboardModel(summary());

    expect(model.quickFilters).toEqual([
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
    ]);
  });

  it('serializes quick filters for audit-page deep links', () => {
    expect(buildAuditFilterQuery({ result: 'DENY' })).toBe('result=DENY');
    expect(buildAuditFilterQuery({ action: 'DLP_PATTERN_DETECTED' })).toBe(
      'action=DLP_PATTERN_DETECTED',
    );
    expect(
      buildAuditFilterQuery({
        documentId: 'doc-secret-board',
        aclId: 'acl-all-download',
      }),
    ).toBe('documentId=doc-secret-board&aclId=acl-all-download');
    expect(
      buildAuditFilterQuery({
        recommendationId: 'actor-access-review:DENY_BURST:viewer-1',
      }),
    ).toBe('recommendationId=actor-access-review%3ADENY_BURST%3Aviewer-1');
    expect(
      buildAuditFilterQuery({
        actorId: 'editor-1',
        actionGroup: 'AUTHORIZED_CONTENT_ACCESS',
        from: '2026-05-30T10:00:00.000Z',
        to: '2026-05-30T10:08:00.000Z',
      }),
    ).toBe(
      'actionGroup=AUTHORIZED_CONTENT_ACCESS&actorId=editor-1&from=2026-05-30T10%3A00%3A00.000Z&to=2026-05-30T10%3A08%3A00.000Z',
    );
  });

  it('builds metadata-only evidence packets for recommendation export', () => {
    const model = buildSecurityDashboardModel(
      summary({
        chain: { valid: true, checked: 42 },
        recommendations: [
          {
            id: 'dlp-classification-review',
            type: 'DLP_CLASSIFICATION_REVIEW',
            severity: 'warning',
            title: 'Review DLP-driven classification controls',
            reason: '1 DLP detection event was recorded in the audit summary.',
            recommendedAction:
              'Confirm classification escalation, verify override reasons, and block unsafe downgrade paths.',
            evidence: ['1 DLP detection event'],
            affectedDocumentIds: [],
            affectedActorIds: [],
            auditFilters: { action: 'DLP_PATTERN_DETECTED' },
            workflow: { status: 'REVIEWED' },
          },
        ],
      }),
    );

    const packet = buildRecommendationEvidencePacket({
      recommendation: model.recommendations.items[0],
      auditChain: { valid: true, checked: 42 },
      workflowHistory: [
        {
          eventId: 'event-reviewed',
          status: 'REVIEWED',
          note: 'Reviewed with ticket SEC-12',
          updatedAt: '2026-05-31T11:00:00.000Z',
          updatedBy: 'co1',
        },
      ],
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(packet).toEqual({
      generatedAt: '2026-06-01T00:00:00.000Z',
      metadataOnly: true,
      excludedSensitiveFields: [
        'fileContent',
        'objectKey',
        'presignedUrl',
        'grantToken',
      ],
      auditChain: { valid: true, checked: 42 },
      recommendation: expect.objectContaining({
        id: 'dlp-classification-review',
        workflow: { status: 'REVIEWED' },
      }),
      playbook: expect.objectContaining({
        ownerLabel: 'DLP reviewer',
        slaHours: 72,
      }),
      workflowHistory: [
        {
          eventId: 'event-reviewed',
          status: 'REVIEWED',
          note: 'Reviewed with ticket SEC-12',
          updatedAt: '2026-05-31T11:00:00.000Z',
          updatedBy: 'co1',
        },
      ],
    });
    expect(JSON.stringify(packet)).not.toContain('objectKeyValue');
    expect(JSON.stringify(packet)).not.toContain('grant-token');
    expect(JSON.stringify(packet)).not.toContain('presigned-url');
    expect(JSON.stringify(packet)).not.toContain('file-content');
  });
});
