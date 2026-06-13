import { VersionsService } from './versions.service';

const context = {
  traceId: 'trace-1',
  actorId: 'editor-1',
  roles: ['editor'],
  authorization: 'Bearer token',
} as any;

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
  const mockGetApprovers = jest.fn();
  const mockNotify = jest.fn();
  let service: VersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      currentVersion: 0,
      classification: 'INTERNAL',
      title: 'Q3 Report',
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
    // Approver list includes the uploader (editor-1), who must be filtered out.
    mockGetApprovers.mockResolvedValue({
      userIds: ['approver-1', 'admin-1', 'editor-1'],
    });
    mockNotify.mockResolvedValue(undefined);
    service = new VersionsService(
      {
        document: {
          findUnique: mockDocumentFindUnique,
          findFirst: mockDocumentFindUnique,
        },
        $transaction: mockTransaction,
      } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
      { getApprovers: mockGetApprovers } as any,
      { notify: mockNotify } as any,
    );
  });

  it('persists DLP findings and escalates the document classification', async () => {
    await service.create('doc-1', dto as any, actor as any, context);

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

  it('downgrades the document aggregate when a new clean version replaces a detected one', async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      currentVersion: 1,
      classification: 'CONFIDENTIAL',
      dlpStatus: 'DETECTED',
      title: 'Q3 Report',
    });
    const cleanDto = {
      version: 2,
      objectKey: 'doc/doc-1/v2/clean.docx',
      checksum: 'def456',
      size: 128,
      filename: 'clean.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dlpStatus: 'CLEAR',
      dlpFindings: [],
    };

    await service.create('doc-1', cleanDto as any, actor as any, context);

    const updateData = mockDocumentUpdate.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      currentVersion: 2,
      dlpStatus: 'CLEAR',
      dlpFindings: [],
      dlpDetectedAt: null,
    });
    // An earlier CONFIDENTIAL label is never silently downgraded by a clean scan.
    expect(updateData).not.toHaveProperty('classification');
  });

  it('notifies approvers + admins of the upload, excluding the uploader', async () => {
    await service.create('doc-1', dto as any, actor as any, context);

    const versionUploaded = mockNotify.mock.calls.find(
      ([, payload]) => payload.type === 'VERSION_UPLOADED',
    );
    expect(versionUploaded).toBeDefined();
    const [, payload] = versionUploaded;
    expect(payload).toMatchObject({
      type: 'VERSION_UPLOADED',
      docId: 'doc-1',
      docTitle: 'Q3 Report',
      recipientIds: ['approver-1', 'admin-1'],
    });
    expect(payload.recipientIds).not.toContain('editor-1');
  });

  it('emits an additional DLP_DETECTED notification when the scan flags content', async () => {
    await service.create('doc-1', dto as any, actor as any, context);

    const types = mockNotify.mock.calls.map(([, payload]) => payload.type);
    expect(types).toContain('VERSION_UPLOADED');
    expect(types).toContain('DLP_DETECTED');

    const [, dlpPayload] = mockNotify.mock.calls.find(
      ([, payload]) => payload.type === 'DLP_DETECTED',
    );
    expect(dlpPayload.metadata).toMatchObject({
      version: 1,
      findingCount: 1,
      suggestedClassification: 'CONFIDENTIAL',
      escalatedToConfidential: true,
    });
  });

  it('does not emit DLP_DETECTED for a clean upload', async () => {
    const cleanDto = { ...dto, dlpStatus: 'CLEAR', dlpFindings: [] };
    await service.create('doc-1', cleanDto as any, actor as any, context);

    const types = mockNotify.mock.calls.map(([, payload]) => payload.type);
    expect(types).toContain('VERSION_UPLOADED');
    expect(types).not.toContain('DLP_DETECTED');
  });

  it('does not throw or notify when the approver list is empty', async () => {
    mockGetApprovers.mockResolvedValue({ userIds: [] });
    await expect(
      service.create('doc-1', dto as any, actor as any, context),
    ).resolves.toBeDefined();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('VersionsService restore', () => {
  const actor = { sub: 'editor-1', roles: ['editor'] };
  const mockDocumentFindUnique = jest.fn();
  const mockVersionFindUnique = jest.fn();
  const mockVersionCreate = jest.fn();
  const mockDocumentUpdate = jest.fn();
  const mockTransaction = jest.fn();
  const mockGetApprovers = jest.fn();
  const mockNotify = jest.fn();
  let service: VersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      currentVersion: 3,
      classification: 'INTERNAL',
      title: 'Q3 Report',
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
    mockGetApprovers.mockResolvedValue({ userIds: ['approver-1'] });
    mockNotify.mockResolvedValue(undefined);
    service = new VersionsService(
      {
        document: {
          findUnique: mockDocumentFindUnique,
          findFirst: mockDocumentFindUnique,
        },
        documentVersion: { findUnique: mockVersionFindUnique },
        $transaction: mockTransaction,
      } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
      { getApprovers: mockGetApprovers } as any,
      { notify: mockNotify } as any,
    );
  });

  it('creates a new version that copies the source version file pointer', async () => {
    const result = await service.restore('doc-1', 1, actor as any, context);

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

  it('notifies VERSION_UPLOADED on restore but never DLP_DETECTED', async () => {
    await service.restore('doc-1', 1, actor as any, context);

    const types = mockNotify.mock.calls.map(([, payload]) => payload.type);
    expect(types).toContain('VERSION_UPLOADED');
    expect(types).not.toContain('DLP_DETECTED');
  });

  it('rejects restoring a version that does not exist', async () => {
    mockVersionFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.restore('doc-1', 9, actor as any, context),
    ).rejects.toThrow();
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
    await expect(
      service.restore('doc-1', 3, actor as any, context),
    ).rejects.toThrow();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  it('forbids non-owner non-admin from restoring', async () => {
    await expect(
      service.restore(
        'doc-1',
        1,
        {
          sub: 'intruder',
          roles: ['viewer'],
        } as any,
        context,
      ),
    ).rejects.toThrow();
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  it('treats a document from another organization as not found', async () => {
    mockDocumentFindUnique.mockResolvedValueOnce(null); // org-scoped findFirst → null
    await expect(
      service.restore('doc-other-org', 1, actor as any, context),
    ).rejects.toThrow('Document not found');
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });
});
