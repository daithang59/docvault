import { VersionsService } from './versions.service';

describe('VersionsService DLP state', () => {
  const actor = { sub: 'editor-1', roles: ['editor'] };
  const findings = [
    {
      type: 'EMAIL',
      pattern: 'email address',
      severity: 'MEDIUM',
      count: 1,
    },
  ];
  const dto = {
    version: 1,
    objectKey: 'doc/doc-1/v1/file.txt',
    checksum: 'abc123',
    size: 64,
    filename: 'file.txt',
    contentType: 'text/plain',
    dlpStatus: 'DETECTED',
    dlpFindings: findings,
    dlpSuggestedClassification: 'CONFIDENTIAL',
  };
  const mockDocumentFindUnique = jest.fn();
  const mockDocumentVersionCreate = jest.fn();
  const mockDocumentUpdate = jest.fn();
  const mockTransaction = jest.fn();
  let service: VersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      currentVersion: 0,
      classification: 'INTERNAL',
    });
    mockDocumentVersionCreate.mockResolvedValue({
      id: 'version-1',
      ...dto,
    });
    mockDocumentUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        documentVersion: { create: mockDocumentVersionCreate },
        document: { update: mockDocumentUpdate },
      }),
    );
    service = new VersionsService({
      document: { findUnique: mockDocumentFindUnique },
      $transaction: mockTransaction,
    } as any);
  });

  it('persists DLP findings and escalates the document classification', async () => {
    await service.create('doc-1', dto as any, actor as any);

    expect(mockDocumentVersionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        docId: 'doc-1',
        version: 1,
        dlpStatus: 'DETECTED',
        dlpFindings: findings,
      }),
    });
    expect(mockDocumentUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        currentVersion: 1,
        classification: 'CONFIDENTIAL',
        dlpStatus: 'DETECTED',
        dlpFindings: findings,
        dlpDetectedAt: expect.any(Date),
      }),
    });
  });
});
