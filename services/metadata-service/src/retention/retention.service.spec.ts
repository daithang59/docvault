import { RetentionService } from './retention.service';

const mockDocumentFindMany = jest.fn();
const mockDocumentUpdate = jest.fn();
const mockWorkflowHistoryCreate = jest.fn();
const mockTransaction = jest.fn((fn) =>
  fn({
    document: { update: mockDocumentUpdate },
    documentWorkflowHistory: { create: mockWorkflowHistoryCreate },
  }),
);
const mockEmitEvent = jest.fn().mockResolvedValue(undefined);

const mockPrisma = {
  document: {
    findMany: mockDocumentFindMany,
    update: mockDocumentUpdate,
  },
  documentWorkflowHistory: {
    create: mockWorkflowHistoryCreate,
  },
  $transaction: mockTransaction,
};

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    title: 'Retention evidence document',
    status: 'PUBLISHED',
    classification: 'SECRET',
    publishedAt: new Date('2026-04-01T00:00:00.000Z'),
    archivedAt: null,
    retentionClass: 'SECRET_30D',
    retentionUntil: new Date('2026-05-01T00:00:00.000Z'),
    retentionReason:
      'SECRET records are retained for 30 days after publication',
    ...overrides,
  };
}

describe('RetentionService', () => {
  let service: RetentionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetentionService(
      mockPrisma as any,
      { emitEvent: mockEmitEvent } as any,
    );
    mockDocumentUpdate.mockResolvedValue(makeDocument({ status: 'ARCHIVED' }));
  });

  it('archives due published records with workflow and audit evidence', async () => {
    const now = new Date('2026-05-30T00:00:00.000Z');
    mockDocumentFindMany.mockResolvedValueOnce([makeDocument()]);

    const result = await service.runRetention({
      now,
      requestedBy: 'admin1',
    });

    expect(result).toEqual({
      archived: 1,
      skipped: 0,
      checkedAt: now.toISOString(),
    });
    expect(mockDocumentUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'ARCHIVED', archivedAt: now },
    });
    expect(mockWorkflowHistoryCreate).toHaveBeenCalledWith({
      data: {
        docId: 'doc-1',
        fromStatus: 'PUBLISHED',
        toStatus: 'ARCHIVED',
        action: 'RETENTION',
        actorId: 'system:retention',
        reason: 'Auto-archived by retention policy SECRET_30D',
      },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'system:retention',
        traceId: 'retention-job',
      }),
      expect.objectContaining({
        action: 'DOCUMENT_AUTO_ARCHIVED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-1',
        result: 'SUCCESS',
        metadata: expect.objectContaining({
          retentionClass: 'SECRET_30D',
          retentionUntil: '2026-05-01T00:00:00.000Z',
          requestedBy: 'admin1',
          triggeredBy: 'system:retention',
        }),
      }),
    );
  });

  it('excludes documents under legal hold from auto-archive candidates', async () => {
    const now = new Date('2026-05-30T00:00:00.000Z');
    mockDocumentFindMany.mockResolvedValueOnce([]);

    await service.runRetention({ now, requestedBy: 'admin1' });

    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ legalHold: false }),
      }),
    );
  });

  it('skips an overdue document that is under legal hold', async () => {
    const now = new Date('2026-05-30T00:00:00.000Z');
    mockDocumentFindMany.mockResolvedValueOnce([
      makeDocument({
        id: 'doc-held',
        legalHold: true,
        retentionUntil: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.runRetention({ now, requestedBy: 'admin1' });

    expect(result.archived).toBe(0);
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it('lists retention evidence with status and days remaining', async () => {
    const now = new Date('2026-05-30T00:00:00.000Z');
    mockDocumentFindMany.mockResolvedValueOnce([
      makeDocument({
        id: 'doc-overdue',
        title: 'Overdue record',
        retentionUntil: new Date('2026-05-29T00:00:00.000Z'),
      }),
      makeDocument({
        id: 'doc-due-soon',
        title: 'Due soon record',
        classification: 'CONFIDENTIAL',
        retentionClass: 'CONFIDENTIAL_180D',
        retentionUntil: new Date('2026-06-04T00:00:00.000Z'),
      }),
      makeDocument({
        id: 'doc-archived',
        title: 'Archived record',
        status: 'ARCHIVED',
        archivedAt: new Date('2026-05-20T00:00:00.000Z'),
        retentionUntil: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.listRetentionEvidence(now);

    expect(result.records).toEqual([
      expect.objectContaining({
        docId: 'doc-archived',
        retentionStatus: 'ARCHIVED',
        daysRemaining: -29,
      }),
      expect.objectContaining({
        docId: 'doc-overdue',
        retentionStatus: 'OVERDUE',
        daysRemaining: -1,
      }),
      expect.objectContaining({
        docId: 'doc-due-soon',
        retentionStatus: 'DUE_SOON',
        daysRemaining: 5,
      }),
    ]);
    expect(result.summary).toEqual({
      tracked: 3,
      active: 0,
      dueSoon: 1,
      overdue: 1,
      archived: 1,
    });
  });
});
