import { AuditService } from './audit.service';

describe('AuditService security summary', () => {
  it('aggregates security evidence counters and repeated deny actors', async () => {
    const countDocuments = jest.fn((filter: Record<string, unknown>) => {
      if (filter.result === 'DENY') return Promise.resolve(7);
      if (filter.action === 'MALWARE_UPLOAD_BLOCKED') return Promise.resolve(2);
      if (filter.action === 'DLP_PATTERN_DETECTED') return Promise.resolve(3);
      if (filter.action === 'DOCUMENT_DOWNLOAD_DENIED') return Promise.resolve(4);
      return Promise.resolve(0);
    });
    const aggregateExec = jest.fn().mockResolvedValue([
      { actorId: 'viewer-1', denyCount: 5 },
    ]);
    const riskFindLean = jest.fn().mockResolvedValue([]);
    const riskFindLimit = jest.fn().mockReturnValue({ lean: riskFindLean });
    const riskFindSort = jest.fn().mockReturnValue({ limit: riskFindLimit });
    const find = jest.fn().mockReturnValue({ sort: riskFindSort });
    const service = new AuditService({
      countDocuments,
      find,
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
    } as any);
    jest
      .spyOn(service, 'verifyChain')
      .mockResolvedValue({ valid: true, checked: 42 });

    await expect(service.securitySummary()).resolves.toEqual({
      chain: { valid: true, checked: 42 },
      totals: {
        deniedEvents: 7,
        malwareBlocked: 2,
        dlpDetections: 3,
        downloadDenied: 4,
      },
      repeatedDenyActors: [{ actorId: 'viewer-1', denyCount: 5 }],
      riskyDocuments: [],
    });

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
    const riskFindLimit = jest.fn().mockReturnValue({ lean: riskFindLean });
    const riskFindSort = jest.fn().mockReturnValue({ limit: riskFindLimit });
    const find = jest.fn().mockReturnValue({ sort: riskFindSort });
    const service = new AuditService({
      countDocuments,
      find,
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
    expect(riskFindSort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(riskFindLimit).toHaveBeenCalledWith(500);
  });
});
