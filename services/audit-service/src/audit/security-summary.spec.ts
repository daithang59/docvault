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
    const service = new AuditService({
      countDocuments,
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
});
