import { describe, expect, it } from 'vitest';
import {
  buildEvidenceBundle,
  buildEvidenceCaseNarrative,
  buildEvidenceCenterDocumentPacket,
  EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS,
  buildEvidenceCenterModel,
  buildEvidenceCenterManifest,
} from './evidence-center';
import type { SecuritySummary } from '@/features/audit/audit.types';
import type { ComplianceEvidencePacket } from '@/features/documents/documents.types';
import type { RetentionEvidenceResult } from '@/features/retention/retention.types';

function securitySummary(): SecuritySummary {
  return {
    chain: { valid: true, checked: 42 },
    totals: {
      deniedEvents: 3,
      malwareBlocked: 1,
      dlpDetections: 2,
      downloadDenied: 4,
    },
    repeatedDenyActors: [],
    riskyDocuments: [],
    behaviorSignals: [],
    recommendations: [
      {
        id: 'document-access-review:doc-secret',
        type: 'DOCUMENT_ACCESS_REVIEW',
        severity: 'critical',
        title: 'Tighten access for high-risk SECRET document',
        reason: 'Document doc-secret reached risk score 95.',
        recommendedAction: 'Review ACLs and recent grants.',
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
      {
        id: 'actor-access-review:DENY_BURST:viewer-1',
        type: 'ACTOR_ACCESS_REVIEW',
        severity: 'warning',
        title: 'Investigate denied access burst for viewer-1',
        reason: 'Actor viewer-1 triggered DENY_BURST.',
        recommendedAction: 'Inspect role, group membership, and ACL assignments.',
        evidence: ['3 denied security events'],
        affectedDocumentIds: [],
        affectedActorIds: ['viewer-1'],
        auditFilters: { actorId: 'viewer-1' },
        workflow: { status: 'OPEN' },
      },
    ],
  };
}

function retentionEvidence(): RetentionEvidenceResult {
  return {
    checkedAt: '2026-06-02T08:00:00.000Z',
    summary: {
      tracked: 2,
      active: 1,
      dueSoon: 1,
      overdue: 0,
      archived: 0,
    },
    records: [
      {
        docId: 'doc-secret',
        title: 'Secret Plan',
        status: 'PUBLISHED',
        classification: 'SECRET',
        publishedAt: '2026-05-01T08:00:00.000Z',
        archivedAt: null,
        retentionClass: 'SECRET_7Y',
        retentionUntil: '2033-05-01T08:00:00.000Z',
        retentionReason: 'Secret retention policy',
        retentionStatus: 'DUE_SOON',
        daysRemaining: 5,
      },
      {
        docId: 'doc-public',
        title: 'Public Note',
        status: 'PUBLISHED',
        classification: 'PUBLIC',
        publishedAt: '2026-05-02T08:00:00.000Z',
        archivedAt: null,
        retentionClass: null,
        retentionUntil: null,
        retentionReason: null,
        retentionStatus: 'UNSET',
        daysRemaining: null,
      },
    ],
  };
}

describe('buildEvidenceCenterModel', () => {
  it('summarizes evidence sources and export targets without content-bearing fields', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });

    expect(model.generatedAt).toBe('2026-06-02T09:00:00.000Z');
    expect(model.auditChain).toEqual({ valid: true, checked: 42 });
    expect(model.sourceCards).toEqual([
      expect.objectContaining({
        key: 'audit-chain',
        label: 'Audit Chain',
        value: '42',
        state: 'ready',
      }),
      expect.objectContaining({
        key: 'recommendations',
        label: 'Recommendation Packets',
        value: '2',
        state: 'attention',
      }),
      expect.objectContaining({
        key: 'retention',
        label: 'Retention Evidence',
        value: '2',
        state: 'attention',
      }),
      expect.objectContaining({
        key: 'document-packets',
        label: 'Document Packets',
        value: '2',
        state: 'ready',
      }),
    ]);
    expect(model.recommendationTargets[0]).toMatchObject({
      id: 'document-access-review:doc-secret',
      title: 'Tighten access for high-risk SECRET document',
      severity: 'critical',
      workflowStatus: 'INVESTIGATING',
      ownerLabel: 'Document owner',
      auditQuery: 'documentId=doc-secret',
      affectedDocumentId: 'doc-secret',
      packetFilename:
        'document-access-review-doc-secret-recommendation-evidence.json',
    });
    expect(model.documentPacketTargets[0]).toMatchObject({
      docId: 'doc-secret',
      title: 'Secret Plan',
      classification: 'SECRET',
      retentionStatus: 'DUE_SOON',
      packetFilename: 'docvault-evidence-secret-plan.json',
    });
    expect(JSON.stringify(model)).not.toContain('objectKey');
    expect(JSON.stringify(model)).not.toContain('grantToken');
    expect(JSON.stringify(model)).not.toContain('presignedUrl');
    expect(JSON.stringify(model)).not.toContain('fileContent');
  });
});

describe('buildEvidenceCenterManifest', () => {
  it('builds a metadata-only demo bundle manifest', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });

    const manifest = buildEvidenceCenterManifest(model);

    expect(manifest).toEqual({
      generatedAt: '2026-06-02T09:00:00.000Z',
      metadataOnly: true,
      excludedSensitiveFields: [
        ...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS,
      ],
      auditChain: { valid: true, checked: 42 },
      summary: {
        recommendations: 2,
        documentPackets: 2,
        retentionRecords: 2,
        retentionDueSoon: 1,
        retentionOverdue: 0,
      },
      recommendationPacketIds: [
        'document-access-review:doc-secret',
        'actor-access-review:DENY_BURST:viewer-1',
      ],
      documentPacketIds: ['doc-secret', 'doc-public'],
    });
  });
});

describe('buildEvidenceBundle', () => {
  it('builds a selected metadata-only evidence bundle manifest', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });

    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['actor-access-review:DENY_BURST:viewer-1'],
      selectedDocumentIds: ['doc-secret'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    expect(bundle).toMatchObject({
      bundleId: 'docvault-evidence-bundle-20260602093000',
      bundleFilename: 'docvault-evidence-bundle-20260602093000.json',
      generatedAt: '2026-06-02T09:30:00.000Z',
      metadataOnly: true,
      excludedSensitiveFields: [
        ...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS,
      ],
      summary: {
        recommendationPackets: 1,
        documentPackets: 1,
        totalPackets: 2,
        missingSelections: 0,
      },
      retentionSummary: {
        tracked: 2,
        active: 1,
        dueSoon: 1,
        overdue: 0,
        archived: 0,
      },
    });
    expect(bundle.packets.recommendations).toEqual([
      expect.objectContaining({
        id: 'actor-access-review:DENY_BURST:viewer-1',
        title: 'Investigate denied access burst for viewer-1',
        packetFilename:
          'actor-access-review-deny-burst-viewer-1-recommendation-evidence.json',
        workflowStatus: 'OPEN',
      }),
    ]);
    expect(bundle.packets.documents).toEqual([
      expect.objectContaining({
        id: 'doc-secret',
        title: 'Secret Plan',
        packetFilename: 'docvault-evidence-secret-plan.json',
        retentionStatus: 'DUE_SOON',
      }),
    ]);
    expect(bundle.checklist).toEqual([
      expect.objectContaining({ id: 'manifest', complete: true }),
      expect.objectContaining({ id: 'audit-chain', complete: true }),
      expect.objectContaining({ id: 'recommendation-packets', complete: true }),
      expect.objectContaining({ id: 'document-packets', complete: true }),
      expect.objectContaining({ id: 'retention-evidence', complete: true }),
    ]);
    const bundleJson = JSON.stringify(bundle);
    expect(bundleJson).not.toContain('documents/doc-secret/v1/secret.pdf');
    expect(bundleJson).not.toContain('grant-token');
    expect(bundleJson).not.toContain('download-token');
    expect(bundleJson).not.toContain('https://storage.example/secret.pdf');
    expect(bundleJson).not.toContain('classified bytes');
  });

  it('tracks missing selected packet ids for checklist review', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });

    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['missing-recommendation'],
      selectedDocumentIds: ['missing-document'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    expect(bundle.summary).toMatchObject({
      recommendationPackets: 0,
      documentPackets: 0,
      totalPackets: 0,
      missingSelections: 2,
    });
    expect(bundle.missingSelectionIds).toEqual([
      'missing-recommendation',
      'missing-document',
    ]);
    expect(bundle.checklist).toEqual([
      expect.objectContaining({ id: 'manifest', complete: true }),
      expect.objectContaining({ id: 'audit-chain', complete: true }),
      expect.objectContaining({
        id: 'recommendation-packets',
        complete: false,
      }),
      expect.objectContaining({ id: 'document-packets', complete: false }),
      expect.objectContaining({ id: 'retention-evidence', complete: true }),
    ]);
  });
});

describe('buildEvidenceCaseNarrative', () => {
  it('builds a ready case narrative from a complete selected bundle', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });
    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['actor-access-review:DENY_BURST:viewer-1'],
      selectedDocumentIds: ['doc-secret'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    const narrative = buildEvidenceCaseNarrative(bundle);

    expect(narrative).toMatchObject({
      caseId: 'DOCVAULT-EVIDENCE-BUNDLE-20260602093000',
      status: 'ready',
      headline:
        'Audit case with 1 recommendation packet and 1 document packet.',
      auditChain: {
        state: 'verified',
        label: 'Audit chain verified',
        checkedEvents: 42,
      },
      retentionPosture: {
        state: 'attention',
        label: '1 retention record due soon',
        tracked: 2,
        dueSoon: 1,
        overdue: 0,
      },
      warnings: [],
      blockers: [],
    });
    expect(narrative.timeline).toEqual([
      expect.objectContaining({
        id: 'actor-access-review:DENY_BURST:viewer-1',
        title: 'Investigate denied access burst for viewer-1',
        eventLabel: 'Recommendation packet selected',
        packetFilename:
          'actor-access-review-deny-burst-viewer-1-recommendation-evidence.json',
      }),
    ]);
    expect(narrative.documents).toEqual([
      expect.objectContaining({
        id: 'doc-secret',
        title: 'Secret Plan',
        packetFilename: 'docvault-evidence-secret-plan.json',
      }),
    ]);
  });

  it('marks missing selected packets as incomplete warnings', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });
    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['missing-recommendation'],
      selectedDocumentIds: ['missing-document'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    const narrative = buildEvidenceCaseNarrative(bundle);

    expect(narrative.status).toBe('incomplete');
    expect(narrative.warnings).toEqual([
      'Missing selected packet: missing-recommendation',
      'Missing selected packet: missing-document',
      'No recommendation packet selected.',
      'No document packet selected.',
    ]);
    expect(narrative.blockers).toEqual([]);
  });

  it('blocks presentation readiness when the audit chain is invalid', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: {
        ...securitySummary(),
        chain: { valid: false, checked: 42 },
      },
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });
    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['actor-access-review:DENY_BURST:viewer-1'],
      selectedDocumentIds: ['doc-secret'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    const narrative = buildEvidenceCaseNarrative(bundle);

    expect(narrative.status).toBe('blocked');
    expect(narrative.auditChain).toMatchObject({
      state: 'blocked',
      label: 'Audit chain needs review',
    });
    expect(narrative.blockers).toEqual([
      'Audit chain is not verified. Resolve tamper evidence before presenting this case.',
    ]);
  });

  it('blocks presentation readiness when retention evidence has overdue records', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: {
        ...retentionEvidence(),
        summary: {
          tracked: 2,
          active: 0,
          dueSoon: 0,
          overdue: 1,
          archived: 1,
        },
      },
      generatedAt: '2026-06-02T09:00:00.000Z',
    });
    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['actor-access-review:DENY_BURST:viewer-1'],
      selectedDocumentIds: ['doc-secret'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });

    const narrative = buildEvidenceCaseNarrative(bundle);

    expect(narrative.status).toBe('blocked');
    expect(narrative.retentionPosture).toMatchObject({
      state: 'blocked',
      label: '1 retention record overdue',
    });
    expect(narrative.blockers).toEqual([
      'Retention evidence has overdue records. Resolve or explain retention exceptions before presenting this case.',
    ]);
  });
});

describe('buildEvidenceCenterDocumentPacket', () => {
  it('removes content-bearing fields from document evidence packets before export', () => {
    const packet = {
      generatedAt: '2026-06-02T09:00:00.000Z',
      generatedBy: {
        id: 'co-1',
        username: 'co1',
        roles: ['compliance_officer'],
      },
      scope: {
        type: 'DOCUMENT',
        documentId: 'doc-secret',
        asOf: null,
      },
      document: {
        id: 'doc-secret',
        title: 'Secret Plan',
        status: 'PUBLISHED',
        classification: 'SECRET',
        ownerId: 'editor-1',
        currentVersion: 1,
        tags: ['board'],
        createdAt: '2026-05-01T08:00:00.000Z',
        updatedAt: '2026-05-02T08:00:00.000Z',
      },
      versions: [
        {
          id: 'version-1',
          docId: 'doc-secret',
          version: 1,
          objectKey: 'documents/doc-secret/v1/secret.pdf',
          checksum: 'sha256-secret',
          size: 1024,
          filename: 'secret.pdf',
          contentType: 'application/pdf',
          createdAt: '2026-05-01T08:00:00.000Z',
          createdBy: 'editor-1',
          storagePath: 'documents/doc-secret/v1/secret.pdf',
        },
      ],
      aclEntries: [],
      workflowHistory: [],
      retention: {
        checkedAt: '2026-06-02T08:00:00.000Z',
        summary: { tracked: 1 },
        record: {
          docId: 'doc-secret',
          retentionStatus: 'ACTIVE',
        },
        fields: {
          retentionClass: 'SECRET_7Y',
          retentionUntil: '2033-05-01T08:00:00.000Z',
          retentionReason: 'Secret retention policy',
        },
      },
      audit: {
        chain: { valid: true, checked: 42 },
        events: [
          {
            eventId: 'event-1',
            action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
            actorId: 'viewer-1',
            actorRoles: ['viewer'],
            result: 'SUCCESS',
            resourceType: 'DOCUMENT',
            resourceId: 'doc-secret',
            timestamp: '2026-06-02T08:30:00.000Z',
            hash: 'hash-1',
            metadata: {
              objectKey: 'documents/doc-secret/v1/secret.pdf',
              grantToken: 'grant-token',
              downloadToken: 'download-token',
              nested: {
                presignedUrl: 'https://storage.example/secret.pdf',
                fileContent: 'classified bytes',
                kept: 'metadata',
              },
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 200,
      },
    } as unknown as ComplianceEvidencePacket;

    const sanitized = buildEvidenceCenterDocumentPacket(packet);

    expect(sanitized.metadataOnly).toBe(true);
    expect(sanitized.excludedSensitiveFields).toEqual([
      ...EVIDENCE_CENTER_EXCLUDED_SENSITIVE_FIELDS,
    ]);
    expect(sanitized.versions[0]).toMatchObject({
      id: 'version-1',
      filename: 'secret.pdf',
      checksum: 'sha256-secret',
    });
    expect(sanitized.audit.events[0].metadata).toEqual({
      nested: {
        kept: 'metadata',
      },
    });
    expect(sanitized.versions[0]).not.toHaveProperty('objectKey');
    expect(sanitized.versions[0]).not.toHaveProperty('storagePath');
    expect(sanitized.audit.events[0].metadata).not.toHaveProperty('objectKey');
    expect(sanitized.audit.events[0].metadata).not.toHaveProperty('grantToken');
    expect(sanitized.audit.events[0].metadata).not.toHaveProperty('downloadToken');
    expect(JSON.stringify(sanitized)).not.toContain(
      'documents/doc-secret/v1/secret.pdf',
    );
    expect(JSON.stringify(sanitized)).not.toContain('grant-token');
    expect(JSON.stringify(sanitized)).not.toContain('download-token');
    expect(JSON.stringify(sanitized)).not.toContain(
      'https://storage.example/secret.pdf',
    );
    expect(JSON.stringify(sanitized)).not.toContain('classified bytes');
  });
});
