import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('DocumentsService DLP downgrade guard', () => {
  const context = {
    traceId: 'trace-1',
    actorId: 'editor-1',
    roles: ['editor'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const user = { sub: 'editor-1', roles: ['editor'] };
  const mockDocumentFindUnique = jest.fn();
  const mockDocumentUpdate = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      title: 'DLP doc',
      description: null,
      tags: [],
      classification: 'CONFIDENTIAL',
      dlpStatus: 'DETECTED',
    });
    service = new DocumentsService(
      {
        document: {
          findUnique: mockDocumentFindUnique,
          update: mockDocumentUpdate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
    );
  });

  it('denies downgrading a DLP-detected document to public', async () => {
    await expect(
      service.update(
        'doc-1',
        { classification: 'PUBLIC' },
        user as any,
        context as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
    expect(mockEmitEvent).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        action: 'DLP_CLASSIFICATION_DOWNGRADE_DENIED',
        result: 'DENY',
        reason:
          'DLP-detected documents cannot be downgraded below CONFIDENTIAL',
      }),
    );
  });

  it('requires an admin override reason before downgrading a DLP-detected document', async () => {
    await expect(
      service.update(
        'doc-1',
        { classification: 'PUBLIC' },
        { sub: 'admin-1', roles: ['admin'] } as any,
        { ...context, actorId: 'admin-1', roles: ['admin'] } as any,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', roles: ['admin'] }),
      expect.objectContaining({
        action: 'DLP_CLASSIFICATION_DOWNGRADE_DENIED',
        result: 'DENY',
        reason:
          'Admin override reason is required for DLP classification downgrade',
      }),
    );
  });

  it('allows an admin to downgrade a DLP-detected document when an override reason is audited', async () => {
    mockDocumentUpdate.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
      title: 'DLP doc',
      description: null,
      tags: [],
      classification: 'PUBLIC',
      dlpStatus: 'DETECTED',
      updatedAt: new Date('2026-05-31T02:00:00.000Z'),
    });

    const result = await service.update(
      'doc-1',
      {
        classification: 'PUBLIC',
        classificationOverrideReason: 'False positive from legacy sample',
      } as any,
      { sub: 'admin-1', roles: ['admin'] } as any,
      { ...context, actorId: 'admin-1', roles: ['admin'] } as any,
    );

    expect(result).toEqual(
      expect.objectContaining({ classification: 'PUBLIC' }),
    );
    expect(mockDocumentUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { classification: 'PUBLIC' },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', roles: ['admin'] }),
      expect.objectContaining({
        action: 'DLP_CLASSIFICATION_OVERRIDE_APPROVED',
        result: 'SUCCESS',
        reason: 'False positive from legacy sample',
        metadata: expect.objectContaining({
          docId: 'doc-1',
          currentClassification: 'CONFIDENTIAL',
          requestedClassification: 'PUBLIC',
          dlpStatus: 'DETECTED',
          overrideReason: 'False positive from legacy sample',
        }),
      }),
    );
  });
});

describe('DocumentsService access-controlled list visibility', () => {
  const mockDocumentFindMany = jest.fn();
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindMany.mockResolvedValue([]);
    service = new DocumentsService(
      {
        document: {
          findMany: mockDocumentFindMany,
        },
      } as any,
      { emitEvent: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  it('includes GROUP READ ALLOW subjects in list visibility and does not grant visibility from deny-only ACL', async () => {
    await service.findAll({
      traceId: 'trace-1',
      actorId: 'viewer-1',
      roles: ['viewer'],
      groups: ['finance-team'],
    } as any);

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"subjectType":"GROUP"');
    expect(queryText).toContain('"subjectId":"finance-team"');
    expect(queryText).toContain('"subjectId":"/finance-team"');
    expect(queryText).toContain('"permission":"READ"');
    expect(queryText).toContain('"effect":"ALLOW"');
    expect(queryText).toContain('"NOT"');
    expect(queryText).toContain('"effect":"DENY"');
  });

  it('applies READ DENY filtering to admin list visibility', async () => {
    await service.findAll({
      traceId: 'trace-1',
      actorId: 'admin-1',
      roles: ['admin'],
      groups: ['blocked-team'],
    } as any);

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"subjectType":"GROUP"');
    expect(queryText).toContain('"subjectId":"blocked-team"');
    expect(queryText).toContain('"subjectId":"/blocked-team"');
    expect(queryText).toContain('"NOT"');
    expect(queryText).toContain('"effect":"DENY"');
  });

  it('returns latest version file metadata in document list summaries', async () => {
    mockDocumentFindMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Published contract',
        versions: [
          {
            filename: 'contract-v2.pdf',
            contentType: 'application/pdf',
            size: 2048,
          },
        ],
      },
    ]);

    const result = await service.findAll({
      traceId: 'trace-1',
      actorId: 'viewer-1',
      roles: ['viewer'],
      groups: [],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        filename: 'contract-v2.pdf',
        contentType: 'application/pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('versions');
  });

  it('searches document list by latest version filename', async () => {
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'viewer-1',
        roles: ['viewer'],
        groups: [],
      } as any,
      'contract-v2.pdf',
    );

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"versions"');
    expect(queryText).toContain('"filename"');
    expect(queryText).toContain('"contract-v2.pdf"');
  });
});
