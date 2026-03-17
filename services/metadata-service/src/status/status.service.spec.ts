import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { StatusService } from './status.service';

// --- Mock PrismaService ---
const mockDocumentUpdate = jest.fn();
const mockWorkflowHistoryCreate = jest.fn();
const mockTransaction = jest.fn((fn) =>
  fn({
    document: { update: mockDocumentUpdate },
    documentWorkflowHistory: { create: mockWorkflowHistoryCreate },
  }),
);
const mockFindUnique = jest.fn();

const mockPrisma = {
  document: { findUnique: mockFindUnique, update: mockDocumentUpdate },
  documentWorkflowHistory: { create: mockWorkflowHistoryCreate },
  $transaction: mockTransaction,
};

// --- Mock AuditClient ---
const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
const mockAuditClient = { emitEvent: mockEmitEvent };

// --- Test helpers ---
function makeDocument(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'doc-1',
    title: 'Test',
    ownerId: 'user-1',
    status: 'DRAFT',
    currentVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const adminUser = { sub: 'user-1', username: 'user-1', roles: ['admin'] };
const context = {
  traceId: 'trace-1',
  authorization: 'Bearer xxx',
  actorId: 'user-1',
  roles: ['admin'],
  ip: '127.0.0.1',
};

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StatusService(mockPrisma as any, mockAuditClient as any);
    mockDocumentUpdate.mockResolvedValue(makeDocument({ status: 'PENDING' }));
    mockWorkflowHistoryCreate.mockResolvedValue({});
  });

  // --- Valid transitions ---

  it('SUBMIT: DRAFT -> PENDING', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'DRAFT' }));

    await service.update(
      'doc-1',
      { status: 'PENDING', action: 'SUBMIT' },
      adminUser,
      context,
    );

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWorkflowHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'DRAFT',
          toStatus: 'PENDING',
          action: 'SUBMIT',
        }),
      }),
    );
  });

  it('APPROVE: PENDING -> PUBLISHED (sets publishedAt)', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'PENDING' }));
    mockDocumentUpdate.mockResolvedValue(makeDocument({ status: 'PUBLISHED' }));

    await service.update(
      'doc-1',
      { status: 'PUBLISHED', action: 'APPROVE' },
      adminUser,
      context,
    );

    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('REJECT: PENDING -> DRAFT (saves reason)', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'PENDING' }));
    mockDocumentUpdate.mockResolvedValue(makeDocument({ status: 'DRAFT' }));

    await service.update(
      'doc-1',
      { status: 'DRAFT', action: 'REJECT', reason: 'Bad format' },
      adminUser,
      context,
    );

    expect(mockWorkflowHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REJECT',
          reason: 'Bad format',
        }),
      }),
    );
  });

  it('ARCHIVE: PUBLISHED -> ARCHIVED (sets archivedAt)', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'PUBLISHED' }));
    mockDocumentUpdate.mockResolvedValue(makeDocument({ status: 'ARCHIVED' }));

    await service.update(
      'doc-1',
      { status: 'ARCHIVED', action: 'ARCHIVE' },
      adminUser,
      context,
    );

    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ARCHIVED',
          archivedAt: expect.any(Date),
        }),
      }),
    );
  });

  // --- Invalid transitions ---

  it('rejects APPROVE on DRAFT document', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'DRAFT' }));

    await expect(
      service.update(
        'doc-1',
        { status: 'PUBLISHED', action: 'APPROVE' },
        adminUser,
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects SUBMIT on PENDING document', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'PENDING' }));

    await expect(
      service.update(
        'doc-1',
        { status: 'PENDING', action: 'SUBMIT' },
        adminUser,
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects ARCHIVE on DRAFT document', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'DRAFT' }));

    await expect(
      service.update(
        'doc-1',
        { status: 'ARCHIVED', action: 'ARCHIVE' },
        adminUser,
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects mismatched status and action', async () => {
    mockFindUnique.mockResolvedValue(makeDocument({ status: 'DRAFT' }));

    await expect(
      service.update(
        'doc-1',
        { status: 'PUBLISHED', action: 'SUBMIT' },
        adminUser,
        context,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // --- Edge cases ---

  it('throws NotFoundException for non-existing document', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      service.update(
        'doc-999',
        { status: 'PENDING', action: 'SUBMIT' },
        adminUser,
        context,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException for viewer role', async () => {
    mockFindUnique.mockResolvedValue(makeDocument());

    await expect(
      service.update(
        'doc-1',
        { status: 'PENDING', action: 'SUBMIT' },
        { sub: 'user-2', roles: ['viewer'] },
        context,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
