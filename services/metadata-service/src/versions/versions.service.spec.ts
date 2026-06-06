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
      document: { findUnique: mockDocumentFindUnique, findFirst: mockDocumentFindUnique },
      $transaction: mockTransaction,
    } as any, { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any);
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


describe('VersionsService restore', () => {
  const actor = { sub: 'editor-1', roles: ['editor'] };
  const mockDocumentFindUnique = jest.fn();
  const mockVersionFindUnique = jest.fn();
  const mockVersionCreate = jest.fn();
  const mockDocumentUpdate = jest.fn();
  const mockTransaction = jest.fn();
  let service: VersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      currentVersion: 3,
      classification: 'INTERNAL',
    });
    mockVersionFindUnique.mockResolvedValue({
      id: 'version-1',
      docId: 'doc-1',
      version: 1,
      objectKey: 'doc/doc-1/v1/old.pdf',
      checksum: 'sha256:old',
      size: 1234,
      filename: 'old.pdf',
      contentType: 'application/pdf',
      dlpStatus: 'CLEAR',
      dlpFindings: [],
    });
    mockVersionCreate.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'version-new', ...data }),
    );
    mockDocumentUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        documentVersion: { create: mockVersionCreate },
        document: { update: mockDocumentUpdate },
      }),
    );
    service = new VersionsService({
      document: { findUnique: mockDocumentFindUnique, findFirst: mockDocumentFindUnique },
      documentVersion: { findUnique: mockVersionFindUnique },
      $transaction: mockTransaction,
    } as any, { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any);
  });

  it('creates a new version that copies the source version file pointer', async () => {
    const result = await service.restore('doc-1', 1, actor as any);

    expect(mockVersionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        docId: 'doc-1',
        version: 4,
        objectKey: 'doc/doc-1/v1/old.pdf',
        checksum: 'sha256:old',
        size: 1234,
        filename: 'old.pdf',
        contentType: 'application/pdf',
        createdBy: 'editor-1',
      }),
    });
    expect(mockDocumentUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ currentVersion: 4 }),
    });
    expect(result).toMatchObject({ version: 4 });
  });

  it('rejects restoring a version that does not exist', async () => {
    mockVersionFindUnique.mockResolvedValueOnce(null);
    await expect(service.restore('doc-1', 9, actor as any)).rejects.toThrow();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  it('rejects restoring the current version', async () => {
    mockVersionFindUnique.mockResolvedValueOnce({
      id: 'version-3',
      docId: 'doc-1',
      version: 3,
      objectKey: 'doc/doc-1/v3/cur.pdf',
      checksum: 'sha256:cur',
      size: 10,
      filename: 'cur.pdf',
      contentType: 'application/pdf',
    });
    await expect(service.restore('doc-1', 3, actor as any)).rejects.toThrow();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  it('forbids non-owner non-admin from restoring', async () => {
    await expect(
      service.restore('doc-1', 1, { sub: 'intruder', roles: ['viewer'] } as any),
    ).rejects.toThrow();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });
});
