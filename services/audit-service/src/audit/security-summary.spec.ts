import { BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service';

function makeFindChain(lean: jest.Mock) {
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  return { sort, limit };
}

function makeFindOneChain(result: unknown) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
    }),
  };
}

function makeWorkflowFindOne(
  eventsByRecommendationId: Record<string, unknown | undefined> = {},
) {
  return jest.fn((filter: Record<string, unknown>) => {
    const resourceId =
      typeof filter.resourceId === 'string' ? filter.resourceId : undefined;
    return makeFindOneChain(
      resourceId ? (eventsByRecommendationId[resourceId] ?? null) : null,
    );
  });
}

describe('AuditService security summary', () => {
  it('aggregates security evidence counters and repeated deny actors', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.result === 'DENY') return Promise.resolve(7);
      if (filter.action === 'MALWARE_UPLOAD_BLOCKED') return Promise.resolve(2);
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(3);
      if (filter.action === 'DOCUMENT_DOWNLOAD_DENIED')
        return Promise.resolve(4);
      return Promise.resolve(0);
    });
    const aggregateExec = jest
      .fn()
      .mockResolvedValue([{ actorId: 'viewer-1', denyCount: 5 }]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const riskFind = makeFindChain(riskFindLean);
    const find = jest.fn().mockReturnValue(riskFind);
    const service = new AuditService({
      countDocuments,
      find,
      findOne: makeWorkflowFindOne(),
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    const result = await service.securitySummary();

    expect(result).toMatchObject({
      chain: { valid: true, checked: 42 },
      totals: {
        deniedEvents: 7,
        malwareBlocked: 2,
        dlpDetections: 3,
        downloadDenied: 4,
      },
      repeatedDenyActors: [{ actorId: 'viewer-1', denyCount: 5 }],
      riskyDocuments: [],
      behaviorSignals: [],
    });
    expect(
      result.recommendations.map((recommendation) => recommendation.id),
    ).toEqual([
      'actor-access-review:repeated-deny:viewer-1',
      'dlp-classification-review',
      'malware-upload-review',
    ]);

    expect(countDocuments).toHaveBeenCalledWith({ result: 'DENY' });
    expect(countDocuments).toHaveBeenCalledWith({
      action: 'MALWARE_UPLOAD_BLOCKED',
    });
    expect(countDocuments).toHaveBeenCalledWith({
      action: 'DLP_PATTERN_DETECTED',
    });
    expect(countDocuments).toHaveBeenCalledWith({
      action: 'DOCUMENT_DOWNLOAD_DENIED',
    });
  });

  it('scores risky documents from sensitive authorized access events', async () => {
    const countDocuments = jest.fn().mockResolvedValue(0);
    const aggregateExec = jest.fn().mockResolvedValue([]);
    const riskFindLean = jest.fn().mockResolvedValue([
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:00:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'approver-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:05:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:10:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:15:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-2',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-confidential',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T09:00:00.000Z'),
        metadata: { classification: 'CONFIDENTIAL', docId: 'doc-confidential' },
      },
    ]);
    const riskFind = makeFindChain(riskFindLean);
    const find = jest.fn().mockReturnValue(riskFind);
    const service = new AuditService({
      countDocuments,
      find,
      findOne: makeWorkflowFindOne(),
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    const result = await service.securitySummary();

    expect(result.riskyDocuments).toEqual([
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
      {
        documentId: 'doc-confidential',
        classification: 'CONFIDENTIAL',
        accessCount: 1,
        actorCount: 1,
        latestAccessAt: '2026-05-30T09:00:00.000Z',
        riskScore: 43,
        reasons: ['CONFIDENTIAL classification', '1 download grant'],
      },
    ]);
    expect(find).toHaveBeenCalledWith(
      {
        action: {
          $in: ['DOCUMENT_DOWNLOAD_AUTHORIZED', 'DOCUMENT_PREVIEW_AUTHORIZED'],
        },
        result: 'SUCCESS',
      },
      {
        _id: 0,
        action: 1,
        actorId: 1,
        metadata: 1,
        resourceId: 1,
        resourceType: 1,
        timestamp: 1,
      },
    );
    expect(riskFind.sort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(riskFind.limit).toHaveBeenCalledWith(500);
  });

  it('detects ransomware-like behavior signals from audit event bursts', async () => {
    const countDocuments = jest.fn().mockResolvedValue(0);
    const aggregateExec = jest.fn().mockResolvedValue([]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const behaviorFindLean = jest.fn().mockResolvedValue([
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-1',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:00:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret-1' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-2',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:02:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret-2' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-confidential-1',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:04:00.000Z'),
        metadata: {
          classification: 'CONFIDENTIAL',
          docId: 'doc-confidential-1',
        },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-internal-1',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:06:00.000Z'),
        metadata: { classification: 'INTERNAL', docId: 'doc-internal-1' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-internal-2',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:08:00.000Z'),
        metadata: { classification: 'INTERNAL', docId: 'doc-internal-2' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-1',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:01:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret-1' },
      },
      {
        action: 'DOCUMENT_METADATA_READ_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-2',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:02:00.000Z'),
        metadata: { docId: 'doc-secret-2' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-3',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:03:00.000Z'),
        metadata: { docId: 'doc-secret-3' },
      },
    ]);
    const riskFind = makeFindChain(riskFindLean);
    const behaviorFind = makeFindChain(behaviorFindLean);
    const workflowFind = makeFindChain(jest.fn().mockResolvedValue([]));
    const find = jest
      .fn()
      .mockReturnValueOnce(riskFind)
      .mockReturnValueOnce(behaviorFind)
      .mockReturnValue(workflowFind);
    const service = new AuditService({
      countDocuments,
      find,
      findOne: makeWorkflowFindOne(),
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    const result = await service.securitySummary();

    expect(result.behaviorSignals).toEqual([
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
          '3 download grants',
        ],
      },
      {
        signalId: 'DENY_BURST:viewer-1',
        type: 'DENY_BURST',
        severity: 'warning',
        actorId: 'viewer-1',
        actionCount: 3,
        documentCount: 3,
        windowStartedAt: '2026-05-30T10:01:00.000Z',
        windowEndedAt: '2026-05-30T10:03:00.000Z',
        riskScore: 58,
        reasons: ['3 denied security events', '3 distinct documents'],
      },
    ]);
    expect(find).toHaveBeenNthCalledWith(
      2,
      {
        action: {
          $in: [
            'DOCUMENT_DOWNLOAD_AUTHORIZED',
            'DOCUMENT_PREVIEW_AUTHORIZED',
            'DOCUMENT_DOWNLOAD_DENIED',
            'DOCUMENT_METADATA_READ_DENIED',
            'DOCUMENT_ACL_DELETED',
            'DOCUMENT_ARCHIVE',
            'DOCUMENT_AUTO_ARCHIVED',
            'DOCUMENT_METADATA_UPDATED',
            'DOCUMENT_UPLOADED',
          ],
        },
        timestamp: { $gte: expect.any(Date) },
      },
      {
        _id: 0,
        action: 1,
        actorId: 1,
        metadata: 1,
        resourceId: 1,
        resourceType: 1,
        result: 1,
        timestamp: 1,
      },
    );
  });

  it('generates deterministic recommendations from audit chain, DLP, risk, and anomaly evidence', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.result === 'DENY') return Promise.resolve(4);
      if (filter.action === 'MALWARE_UPLOAD_BLOCKED') return Promise.resolve(1);
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(2);
      if (filter.action === 'DOCUMENT_DOWNLOAD_DENIED')
        return Promise.resolve(3);
      return Promise.resolve(0);
    });
    const aggregateExec = jest
      .fn()
      .mockResolvedValue([{ actorId: 'viewer-1', denyCount: 4 }]);
    const riskFindLean = jest.fn().mockResolvedValue([
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:00:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'approver-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:05:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:10:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_PREVIEW_AUTHORIZED',
        actorId: 'editor-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'SUCCESS',
        timestamp: new Date('2026-05-30T10:15:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
    ]);
    const behaviorFindLean = jest.fn().mockResolvedValue([
      {
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:01:00.000Z'),
        metadata: { classification: 'SECRET', docId: 'doc-secret' },
      },
      {
        action: 'DOCUMENT_METADATA_READ_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-2',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:02:00.000Z'),
        metadata: { docId: 'doc-secret-2' },
      },
      {
        action: 'DOCUMENT_DOWNLOAD_DENIED',
        actorId: 'viewer-1',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-secret-3',
        result: 'DENY',
        timestamp: new Date('2026-05-30T10:03:00.000Z'),
        metadata: { docId: 'doc-secret-3' },
      },
    ]);
    const riskFind = makeFindChain(riskFindLean);
    const behaviorFind = makeFindChain(behaviorFindLean);
    const workflowFind = makeFindChain(jest.fn().mockResolvedValue([]));
    const find = jest
      .fn()
      .mockReturnValueOnce(riskFind)
      .mockReturnValueOnce(behaviorFind)
      .mockReturnValue(workflowFind);
    const service = new AuditService({
      countDocuments,
      find,
      findOne: makeWorkflowFindOne(),
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest.spyOn(service, 'verifyChain').mockResolvedValue({
      valid: false,
      checked: 12,
      firstBrokenIndex: 11,
      message: 'Hash mismatch at event index 11',
    });

    const result = await service.securitySummary();

    expect(result.recommendations).toEqual([
      {
        id: 'audit-chain-review',
        type: 'AUDIT_CHAIN_REVIEW',
        severity: 'critical',
        title: 'Verify audit-chain integrity before exporting evidence',
        reason: 'Hash mismatch at event index 11',
        recommendedAction:
          'Run tamper-evidence verification, isolate the audit store, and compare the broken event with trusted backups.',
        evidence: ['12 audit events checked'],
        affectedDocumentIds: [],
        affectedActorIds: [],
        auditFilters: {},
        workflow: { status: 'OPEN' },
      },
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
          '2 distinct actors',
          '2 download grants',
        ],
        affectedDocumentIds: ['doc-secret'],
        affectedActorIds: [],
        auditFilters: { documentId: 'doc-secret' },
        workflow: { status: 'OPEN' },
      },
      {
        id: 'actor-access-review:DENY_BURST:viewer-1',
        type: 'ACTOR_ACCESS_REVIEW',
        severity: 'warning',
        title: 'Investigate denied access burst for viewer-1',
        reason:
          'Actor viewer-1 triggered DENY_BURST with score 58 across 3 documents.',
        recommendedAction:
          'Inspect role, group membership, and ACL assignments before broadening access.',
        evidence: ['3 denied security events', '3 distinct documents'],
        affectedDocumentIds: [],
        affectedActorIds: ['viewer-1'],
        auditFilters: { actorId: 'viewer-1' },
        workflow: { status: 'OPEN' },
      },
      {
        id: 'dlp-classification-review',
        type: 'DLP_CLASSIFICATION_REVIEW',
        severity: 'warning',
        title: 'Review DLP-driven classification controls',
        reason: '2 DLP detection events were recorded in the audit summary.',
        recommendedAction:
          'Confirm classification escalation, verify override reasons, and block unsafe downgrade paths.',
        evidence: ['2 DLP detection events'],
        affectedDocumentIds: [],
        affectedActorIds: [],
        auditFilters: { action: 'DLP_PATTERN_DETECTED' },
        workflow: { status: 'OPEN' },
      },
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
        workflow: { status: 'OPEN' },
      },
    ]);
  });

  it('attaches the latest recommendation workflow status from audit events', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(1);
      return Promise.resolve(0);
    });
    const aggregateExec = jest.fn().mockResolvedValue([]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const behaviorFindLean = jest.fn().mockResolvedValue([]);
    const workflowFindOneLean = jest.fn().mockResolvedValue({
      actorId: 'co1',
      resourceId: 'dlp-classification-review',
      timestamp: new Date('2026-05-31T11:00:00.000Z'),
      metadata: {
        recommendationId: 'dlp-classification-review',
        status: 'INVESTIGATING',
        note: 'Checking false positive override evidence',
      },
    });
    const workflowFindOneSort = jest
      .fn()
      .mockReturnValue({ lean: workflowFindOneLean });
    const workflowFindOne = jest
      .fn()
      .mockReturnValue({ sort: workflowFindOneSort });
    const find = jest
      .fn()
      .mockReturnValueOnce(makeFindChain(riskFindLean))
      .mockReturnValueOnce(makeFindChain(behaviorFindLean));
    const service = new AuditService({
      countDocuments,
      find,
      findOne: workflowFindOne,
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    const result = await service.securitySummary();

    expect(result.recommendations[0]).toMatchObject({
      id: 'dlp-classification-review',
      workflow: {
        status: 'INVESTIGATING',
        note: 'Checking false positive override evidence',
        updatedBy: 'co1',
        updatedAt: '2026-05-31T11:00:00.000Z',
      },
    });
    expect(workflowFindOne).toHaveBeenCalledWith(
      {
        action: 'SECURITY_RECOMMENDATION_STATUS_UPDATED',
        resourceType: 'SECURITY_RECOMMENDATION',
        resourceId: 'dlp-classification-review',
      },
      {
        _id: 0,
        actorId: 1,
        metadata: 1,
        resourceId: 1,
        timestamp: 1,
      },
    );
    expect(workflowFindOneSort).toHaveBeenCalledWith({
      timestamp: -1,
      _id: -1,
    });
  });

  it('overlays workflow state per recommendation even when another recommendation has many newer updates', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(1);
      if (filter.action === 'MALWARE_UPLOAD_BLOCKED') return Promise.resolve(1);
      return Promise.resolve(0);
    });
    const aggregateExec = jest.fn().mockResolvedValue([]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const behaviorFindLean = jest.fn().mockResolvedValue([]);
    const starvedGlobalWorkflowFindLean = jest.fn().mockResolvedValue(
      Array.from({ length: 10 }, (_item, index) => ({
        actorId: `co-${index}`,
        resourceId: 'dlp-classification-review',
        timestamp: new Date(
          `2026-05-31T12:${String(index).padStart(2, '0')}:00.000Z`,
        ),
        metadata: {
          recommendationId: 'dlp-classification-review',
          status: 'INVESTIGATING',
        },
      })),
    );
    const find = jest
      .fn()
      .mockReturnValueOnce(makeFindChain(riskFindLean))
      .mockReturnValueOnce(makeFindChain(behaviorFindLean))
      .mockReturnValue(makeFindChain(starvedGlobalWorkflowFindLean));
    const workflowFindOne = makeWorkflowFindOne({
      'dlp-classification-review': {
        actorId: 'co-dlp',
        resourceId: 'dlp-classification-review',
        timestamp: new Date('2026-05-31T12:09:00.000Z'),
        metadata: {
          recommendationId: 'dlp-classification-review',
          status: 'INVESTIGATING',
        },
      },
      'malware-upload-review': {
        actorId: 'co-malware',
        resourceId: 'malware-upload-review',
        timestamp: new Date('2026-05-31T09:00:00.000Z'),
        metadata: {
          recommendationId: 'malware-upload-review',
          status: 'RESOLVED',
          note: 'Blocked upload reviewed',
        },
      },
    });
    const service = new AuditService({
      countDocuments,
      find,
      findOne: workflowFindOne,
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    const result = await service.securitySummary();
    const recommendations = new Map(
      result.recommendations.map((recommendation) => [
        recommendation.id,
        recommendation,
      ]),
    );

    expect(recommendations.get('dlp-classification-review')?.workflow).toEqual({
      status: 'INVESTIGATING',
      note: undefined,
      updatedAt: '2026-05-31T12:09:00.000Z',
      updatedBy: 'co-dlp',
    });
    expect(recommendations.get('malware-upload-review')?.workflow).toEqual({
      status: 'RESOLVED',
      note: 'Blocked upload reviewed',
      updatedAt: '2026-05-31T09:00:00.000Z',
      updatedBy: 'co-malware',
    });
    expect(workflowFindOne).toHaveBeenCalledTimes(2);
  });

  it('audits recommendation workflow updates without exposing file content or grant data', async () => {
    const create = jest.fn().mockResolvedValue({
      toObject: () => ({ eventId: 'event-recommendation-updated' }),
    });
    const service = new AuditService({
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ hash: 'previous-hash' }),
        }),
      }),
      create,
    } as any);
    const createEvent = jest.spyOn(service, 'create');

    await service.updateSecurityRecommendationWorkflow(
      'dlp-classification-review',
      {
        status: 'REVIEWED',
        note: 'False positive reviewed with ticket SEC-12',
      },
      {
        actorId: 'co1',
        roles: ['compliance_officer'],
        ip: '127.0.0.1',
        traceId: 'trace-1',
      },
    );

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'co1',
        actorRoles: ['compliance_officer'],
        action: 'SECURITY_RECOMMENDATION_STATUS_UPDATED',
        resourceType: 'SECURITY_RECOMMENDATION',
        resourceId: 'dlp-classification-review',
        result: 'SUCCESS',
        reason: 'False positive reviewed with ticket SEC-12',
        timestamp: expect.any(String),
        ip: '127.0.0.1',
        traceId: 'trace-1',
        metadata: {
          recommendationId: 'dlp-classification-review',
          status: 'REVIEWED',
          note: 'False positive reviewed with ticket SEC-12',
        },
      }),
    );
    const metadata = create.mock.calls[0][0].metadata;
    expect(JSON.stringify(metadata)).not.toContain('objectKey');
    expect(JSON.stringify(metadata)).not.toContain('grantToken');
    expect(JSON.stringify(metadata)).not.toContain('presigned');
    expect(JSON.stringify(metadata)).not.toContain('content');
  });

  it('rejects invalid recommendation workflow status as a bad request', async () => {
    const service = new AuditService({} as any);

    await expect(
      service.updateSecurityRecommendationWorkflow(
        'dlp-classification-review',
        {
          status: 'DONE' as any,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns recommendation workflow history without exposing content-bearing metadata', async () => {
    const workflowFindLean = jest.fn().mockResolvedValue([
      {
        eventId: 'event-reviewed',
        actorId: 'co1',
        timestamp: new Date('2026-05-31T11:00:00.000Z'),
        metadata: {
          recommendationId: 'dlp-classification-review',
          status: 'REVIEWED',
          note: 'Reviewed with ticket SEC-12',
          objectKey: 'documents/private.pdf',
          grantToken: 'grant-token',
          presignedUrl: 'https://storage.example/private.pdf',
          content: 'secret file text',
        },
      },
      {
        eventId: 'event-investigating',
        actorId: 'co2',
        timestamp: new Date('2026-05-31T10:00:00.000Z'),
        metadata: {
          recommendationId: 'dlp-classification-review',
          status: 'INVESTIGATING',
        },
      },
    ]);
    const workflowFind = makeFindChain(workflowFindLean);
    const service = new AuditService({
      find: jest.fn().mockReturnValue(workflowFind),
    } as any);

    const result = await service.getSecurityRecommendationWorkflowHistory(
      'dlp-classification-review',
    );

    expect(result).toEqual([
      {
        eventId: 'event-reviewed',
        status: 'REVIEWED',
        note: 'Reviewed with ticket SEC-12',
        updatedAt: '2026-05-31T11:00:00.000Z',
        updatedBy: 'co1',
      },
      {
        eventId: 'event-investigating',
        status: 'INVESTIGATING',
        note: undefined,
        updatedAt: '2026-05-31T10:00:00.000Z',
        updatedBy: 'co2',
      },
    ]);
    expect(workflowFind.sort).toHaveBeenCalledWith({
      timestamp: -1,
      _id: -1,
    });
    expect(workflowFind.limit).toHaveBeenCalledWith(50);
    expect(JSON.stringify(result)).not.toContain('objectKey');
    expect(JSON.stringify(result)).not.toContain('grantToken');
    expect(JSON.stringify(result)).not.toContain('presigned');
    expect(JSON.stringify(result)).not.toContain('content');
  });

  it('audits recommendation views without exposing file content or grant data', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(1);
      return Promise.resolve(0);
    });
    const aggregateExec = jest.fn().mockResolvedValue([]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const behaviorFindLean = jest.fn().mockResolvedValue([]);
    const find = jest
      .fn()
      .mockReturnValueOnce(makeFindChain(riskFindLean))
      .mockReturnValueOnce(makeFindChain(behaviorFindLean))
      .mockReturnValue(makeFindChain(jest.fn().mockResolvedValue([])));
    const create = jest.fn().mockResolvedValue({
      toObject: () => ({ eventId: 'event-recommendations-viewed' }),
    });
    const service = new AuditService({
      countDocuments,
      find,
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ hash: 'previous-hash' }),
        }),
      }),
      create,
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    const createEvent = jest.spyOn(service, 'create');
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    await service.securitySummary({
      actorId: 'co1',
      roles: ['compliance_officer'],
      ip: '127.0.0.1',
      traceId: 'trace-1',
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'co1',
        actorRoles: ['compliance_officer'],
        action: 'SECURITY_RECOMMENDATIONS_VIEWED',
        resourceType: 'AUDIT',
        result: 'SUCCESS',
        timestamp: expect.any(String),
        ip: '127.0.0.1',
        traceId: 'trace-1',
        metadata: expect.objectContaining({
          recommendationCount: 1,
          recommendationIds: ['dlp-classification-review'],
          criticalCount: 0,
          warningCount: 1,
        }),
      }),
    );
    const metadata = create.mock.calls[0][0].metadata;
    expect(JSON.stringify(metadata)).not.toContain('objectKey');
    expect(JSON.stringify(metadata)).not.toContain('grantToken');
    expect(JSON.stringify(metadata)).not.toContain('presigned');
    expect(JSON.stringify(metadata)).not.toContain('content');
  });
});
