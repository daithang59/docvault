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
