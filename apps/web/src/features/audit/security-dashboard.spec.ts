import { describe, expect, it } from 'vitest';
import type { AuditLogEntry, SecuritySummary } from './audit.types';
import {
  buildAuditFilterQuery,
  buildSecurityDashboardModel,
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

  it('exposes behavior anomaly rows with actor-scoped audit deep links', () => {
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
      auditFilters: { actorId: 'editor-1' },
    });
    expect(model.alerts.map((alert) => alert.title)).toContain(
      'Behavior anomaly detected',
    );
    expect(
      buildAuditFilterQuery(model.behaviorAnomalies.signals[0].auditFilters),
    ).toBe('actorId=editor-1');
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
  });
});
