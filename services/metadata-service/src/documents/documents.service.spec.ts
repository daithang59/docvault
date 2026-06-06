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
          findFirst: mockDocumentFindUnique,
          update: mockDocumentUpdate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
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
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
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

  it('translates has:file query operator into latest-version existence filtering', async () => {
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'viewer-1',
        roles: ['viewer'],
        groups: [],
      } as any,
      'has:file',
    );

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"versions"');
    expect(queryText).toContain('"some"');
  });

  it('translates dlp and retention query operators into document list filters', async () => {
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'viewer-1',
        roles: ['viewer'],
        groups: [],
      } as any,
      'dlp:detected retention:due-soon created:2026-05-01..2026-06-01',
    );

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"dlpStatus":"DETECTED"');
    expect(queryText).toContain('"retentionUntil"');
    expect(queryText).toContain('"gte"');
    expect(queryText).toContain('"lte"');
    expect(queryText).toContain('"createdAt"');
    expect(queryText).toContain('2026-05-01T00:00:00.000Z');
    expect(queryText).toContain('2026-06-01T23:59:59.999Z');
  });

  it('translates has:legal-hold query operator into a legal hold filter', async () => {
    await service.findAll(
      {
        traceId: 'trace-1',
        actorId: 'viewer-1',
        roles: ['viewer'],
        groups: [],
      } as any,
      'has:legal-hold',
    );

    const queryText = JSON.stringify(mockDocumentFindMany.mock.calls[0][0]);

    expect(queryText).toContain('"legalHold":true');
  });
});

describe('DocumentsService legal hold', () => {
  const adminContext = {
    traceId: 'trace-lh',
    actorId: 'admin-1',
    roles: ['admin'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const editorContext = {
    traceId: 'trace-lh',
    actorId: 'editor-1',
    roles: ['editor'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'someone-else',
      title: 'Held doc',
      classification: 'CONFIDENTIAL',
      legalHold: false,
    });
    mockUpdate.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'doc-1',
        ownerId: 'someone-else',
        title: 'Held doc',
        classification: 'CONFIDENTIAL',
        legalHold: false,
        ...data,
      }),
    );
    service = new DocumentsService(
      {
        document: {
          findUnique: mockFindUnique,
          findFirst: mockFindUnique,
          update: mockUpdate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
    );
  });

  it('places a document under legal hold with reason and actor stamp', async () => {
    const result = await service.setLegalHold(
      'doc-1',
      { hold: true, reason: 'Litigation 2026-CV-01' },
      adminContext as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        legalHold: true,
        legalHoldReason: 'Litigation 2026-CV-01',
        legalHoldBy: 'admin-1',
        legalHoldAt: expect.any(Date),
      }),
    });
    expect(result.legalHold).toBe(true);
    expect(mockEmitEvent).toHaveBeenCalledWith(
      adminContext,
      expect.objectContaining({
        action: 'DOCUMENT_LEGAL_HOLD_PLACED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-1',
        result: 'SUCCESS',
      }),
    );
  });

  it('clears a legal hold and resets the hold metadata', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'someone-else',
      title: 'Held doc',
      classification: 'CONFIDENTIAL',
      legalHold: true,
      legalHoldReason: 'Litigation 2026-CV-01',
    });

    await service.setLegalHold('doc-1', { hold: false }, adminContext as any);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        legalHold: false,
        legalHoldReason: null,
        legalHoldBy: null,
        legalHoldAt: null,
      }),
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      adminContext,
      expect.objectContaining({
        action: 'DOCUMENT_LEGAL_HOLD_RELEASED',
        result: 'SUCCESS',
      }),
    );
  });

  it('requires a reason when placing a legal hold', async () => {
    await expect(
      service.setLegalHold('doc-1', { hold: true }, adminContext as any),
    ).rejects.toThrow(BadRequestException);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects legal hold changes from non-admin roles', async () => {
    await expect(
      service.setLegalHold(
        'doc-1',
        { hold: true, reason: 'x' },
        editorContext as any,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws when the document does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.setLegalHold(
        'missing',
        { hold: true, reason: 'x' },
        adminContext as any,
      ),
    ).rejects.toThrow('Document not found');
  });
});

describe('DocumentsService trash', () => {
  const adminContext = {
    traceId: 't',
    actorId: 'admin-1',
    roles: ['admin'],
    authorization: 'Bearer x',
    ip: '127.0.0.1',
  };
  const ownerContext = {
    traceId: 't',
    actorId: 'editor-1',
    roles: ['editor'],
    authorization: 'Bearer x',
    ip: '127.0.0.1',
  };
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      {
        document: {
          findMany: mockFindMany,
          findUnique: mockFindUnique,
          findFirst: mockFindUnique,
          update: mockUpdate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
    );
  });

  it('lists deleted documents for the owner with a recovery deadline', async () => {
    const deletedAt = new Date('2026-06-01T00:00:00.000Z');
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        title: 'Trashed draft',
        ownerId: 'editor-1',
        classification: 'INTERNAL',
        status: 'DELETED',
        deletedAt,
        updatedAt: deletedAt,
      },
    ]);

    const now = new Date('2026-06-10T00:00:00.000Z');
    const result = await service.listTrash(ownerContext as any, now);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DELETED',
          ownerId: 'editor-1',
        }),
      }),
    );
    expect(result[0]).toMatchObject({
      docId: 'doc-1',
      title: 'Trashed draft',
      recoverable: true,
    });
    // 30-day window: deleted 2026-06-01, now 2026-06-10 => 21 days left
    expect(result[0].daysUntilPurge).toBe(21);
  });

  it('lists all deleted documents for an admin (no owner filter)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await service.listTrash(adminContext as any, new Date());
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('DELETED');
    expect(where.ownerId).toBeUndefined();
  });

  it('restores a deleted document back to DRAFT within the recovery window', async () => {
    const deletedAt = new Date('2026-06-01T00:00:00.000Z');
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      title: 'Trashed draft',
      status: 'DELETED',
      deletedAt,
    });
    mockUpdate.mockResolvedValueOnce({ id: 'doc-1', status: 'DRAFT' });

    const now = new Date('2026-06-10T00:00:00.000Z');
    await service.restoreFromTrash('doc-1', ownerContext as any, now);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ status: 'DRAFT', deletedAt: null }),
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      ownerContext,
      expect.objectContaining({
        action: 'DOCUMENT_RESTORED_FROM_TRASH',
        result: 'SUCCESS',
      }),
    );
  });

  it('rejects restoring after the recovery window has elapsed', async () => {
    const deletedAt = new Date('2026-01-01T00:00:00.000Z');
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      status: 'DELETED',
      deletedAt,
    });
    const now = new Date('2026-06-10T00:00:00.000Z');
    await expect(
      service.restoreFromTrash('doc-1', ownerContext as any, now),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects restoring a document that is not deleted', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      status: 'DRAFT',
      deletedAt: null,
    });
    await expect(
      service.restoreFromTrash('doc-1', ownerContext as any, new Date()),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('forbids restoring a document the actor does not own', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'someone-else',
      status: 'DELETED',
      deletedAt: new Date(),
    });
    await expect(
      service.restoreFromTrash('doc-1', ownerContext as any, new Date()),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('DocumentsService approval chain', () => {
  const ownerContext = {
    traceId: 't',
    actorId: 'editor-1',
    roles: ['editor'],
    authorization: 'Bearer x',
    ip: '127.0.0.1',
  };
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      {
        document: {
          findUnique: mockFindUnique,
          findFirst: mockFindUnique,
          update: mockUpdate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
    );
  });

  it('sets an ordered approval chain and resets the step', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      status: 'DRAFT',
    });
    mockUpdate.mockResolvedValueOnce({
      id: 'doc-1',
      approvalChain: ['app-1', 'app-2'],
      approvalStep: 0,
    });

    await service.setApprovalChain(
      'doc-1',
      { approvers: ['app-1', 'app-2'] },
      ownerContext as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { approvalChain: ['app-1', 'app-2'], approvalStep: 0 },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      ownerContext,
      expect.objectContaining({ action: 'DOCUMENT_APPROVAL_CHAIN_SET' }),
    );
  });

  it('rejects an empty approval chain', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      status: 'DRAFT',
    });
    await expect(
      service.setApprovalChain('doc-1', { approvers: [] }, ownerContext as any),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects duplicate approvers in the chain', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      status: 'DRAFT',
    });
    await expect(
      service.setApprovalChain(
        'doc-1',
        { approvers: ['app-1', 'app-1'] },
        ownerContext as any,
      ),
    ).rejects.toThrow();
  });

  it('forbids a non-owner non-admin from setting the chain', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'someone-else',
      status: 'DRAFT',
    });
    await expect(
      service.setApprovalChain(
        'doc-1',
        { approvers: ['app-1'] },
        ownerContext as any,
      ),
    ).rejects.toThrow();
  });

  it('advances the approval step', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'doc-1',
      ownerId: 'editor-1',
      approvalChain: ['app-1', 'app-2'],
      approvalStep: 0,
    });
    mockUpdate.mockResolvedValueOnce({ id: 'doc-1', approvalStep: 1 });

    const result = await service.advanceApprovalStep(
      'doc-1',
      ownerContext as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { approvalStep: 1 },
    });
    expect(result.approvalStep).toBe(1);
  });
});

describe('DocumentsService purge expired trash', () => {
  const systemContext = {
    traceId: 'purge-job',
    actorId: 'system:trash-purge',
    roles: ['admin'],
    authorization: '',
    ip: '127.0.0.1',
  };
  const mockFindMany = jest.fn();
  const mockDelete = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      {
        document: { findMany: mockFindMany, delete: mockDelete },
      } as any,
      { emitEvent: mockEmitEvent } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-1') } as any,
    );
  });

  it('permanently deletes DELETED documents past the recovery window', async () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'old-1',
        title: 'Old one',
        deletedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'old-2',
        title: 'Old two',
        deletedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    mockDelete.mockResolvedValue({});

    const result = await service.purgeExpiredTrash({ now });

    // query targets DELETED docs with deletedAt before the cutoff (now - 30d)
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('DELETED');
    expect(where.deletedAt.lt).toBeInstanceOf(Date);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'old-1' } });
    expect(result.purged).toBe(2);
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'system:trash-purge' }),
      expect.objectContaining({
        action: 'DOCUMENT_TRASH_PURGED',
        result: 'SUCCESS',
      }),
    );
  });

  it('does nothing when there are no expired documents', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await service.purgeExpiredTrash({ now: new Date() });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.purged).toBe(0);
  });

  it('counts failures without aborting the whole run', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'a', title: 'A', deletedAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'b', title: 'B', deletedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    mockDelete
      .mockRejectedValueOnce(new Error('locked'))
      .mockResolvedValueOnce({});

    const result = await service.purgeExpiredTrash({
      now: new Date('2026-06-10T00:00:00.000Z'),
    });
    expect(result.purged).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('DocumentsService tenant isolation', () => {
  const mockFindMany = jest.fn();
  const mockFindFirst = jest.fn();
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    service = new DocumentsService(
      {
        document: { findMany: mockFindMany, findFirst: mockFindFirst },
      } as any,
      { emitEvent: jest.fn().mockResolvedValue(undefined) } as any,
      { requireOrgId: jest.fn().mockResolvedValue('org-acme') } as any,
    );
  });

  it('scopes findAll to the resolved organization', async () => {
    await service.findAll({
      traceId: 't',
      actorId: 'viewer-1',
      roles: ['viewer'],
      groups: [],
    } as any);

    const queryText = JSON.stringify(mockFindMany.mock.calls[0][0]);
    expect(queryText).toContain('"organizationId":"org-acme"');
  });

  it('scopes admin findAll to the resolved organization', async () => {
    await service.findAll({
      traceId: 't',
      actorId: 'admin-1',
      roles: ['admin'],
      groups: [],
    } as any);

    const queryText = JSON.stringify(mockFindMany.mock.calls[0][0]);
    expect(queryText).toContain('"organizationId":"org-acme"');
  });

  it('treats a document from another organization as not found', async () => {
    // findFirst with the org filter returns null → cross-org doc is invisible.
    mockFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.update(
        'doc-from-other-org',
        { title: 'hack' },
        { sub: 'editor-1', roles: ['editor'] } as any,
        { traceId: 't', actorId: 'editor-1', roles: ['editor'] } as any,
      ),
    ).rejects.toThrow('Document not found');

    const whereArg = JSON.stringify(mockFindFirst.mock.calls[0][0]);
    expect(whereArg).toContain('"organizationId":"org-acme"');
  });
});
