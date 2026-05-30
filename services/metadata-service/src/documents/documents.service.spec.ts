import { ForbiddenException } from '@nestjs/common';
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
        reason: 'DLP-detected documents cannot be downgraded below CONFIDENTIAL',
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
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'viewer-1',
        roles: ['viewer'],
        groups: ['finance-team'],
      } as any,
    );

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
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'admin-1',
        roles: ['admin'],
        groups: ['blocked-team'],
      } as any,
    );

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"subjectType":"GROUP"');
    expect(queryText).toContain('"subjectId":"blocked-team"');
    expect(queryText).toContain('"subjectId":"/blocked-team"');
    expect(queryText).toContain('"NOT"');
    expect(queryText).toContain('"effect":"DENY"');
  });
});
