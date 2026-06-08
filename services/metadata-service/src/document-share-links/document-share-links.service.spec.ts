import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DocumentShareLinksService } from './document-share-links.service';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    document: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'doc-1',
        title: 'Quarterly report',
        ownerId: 'owner-1',
        legalHold: false,
        currentVersion: 2,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'doc-1',
        title: 'Quarterly report',
        ownerId: 'owner-1',
        legalHold: false,
        currentVersion: 2,
      }),
    },
    documentShareLink: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'link-1',
          accessCount: 0,
          lastAccessedAt: null,
          revokedAt: null,
          revokedBy: null,
          maxAccessCount: null,
          createdAt: new Date(),
          ...data,
        }),
      ),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({
          id: where?.id ?? 'link-1',
          docId: 'doc-1',
          tokenHash: 'hash',
          permission: 'VIEW',
          createdBy: 'owner-1',
          expiresAt: new Date(Date.now() + 3600_000),
          maxAccessCount: null,
          accessCount: 0,
          lastAccessedAt: null,
          revokedAt: null,
          revokedBy: null,
          createdAt: new Date(),
          ...data,
        }),
      ),
    },
    ...overrides,
  };
}

const adminCtx = {
  traceId: 't1',
  actorId: 'owner-1',
  roles: ['editor'],
  authorization: 'Bearer x',
  ip: '127.0.0.1',
};

describe('DocumentShareLinksService', () => {
  let prisma: any;
  let audit: any;
  let service: DocumentShareLinksService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    audit = { emitEvent: jest.fn().mockResolvedValue(undefined) };
    service = new DocumentShareLinksService(prisma, audit, {
      requireOrgId: jest.fn().mockResolvedValue('org-1'),
    } as any);
  });

  it('creates a share link, returns the raw token once, and stores only its hash', async () => {
    const result = await service.create(
      'doc-1',
      { permission: 'VIEW', expiresInHours: 24, maxAccessCount: 5 } as any,
      adminCtx as any,
    );

    expect(result.token).toEqual(expect.any(String));
    expect(result.token.length).toBeGreaterThanOrEqual(32);

    const createArg = prisma.documentShareLink.create.mock.calls[0][0].data;
    // raw token must never be persisted
    expect(JSON.stringify(createArg)).not.toContain(result.token);
    const expectedHash = createHash('sha256')
      .update(result.token)
      .digest('hex');
    expect(createArg.tokenHash).toBe(expectedHash);
    expect(createArg.permission).toBe('VIEW');
    expect(createArg.docId).toBe('doc-1');
    expect(createArg.createdBy).toBe('owner-1');
    expect(createArg.maxAccessCount).toBe(5);
    expect(new Date(createArg.expiresAt).getTime()).toBeGreaterThan(Date.now());

    expect(audit.emitEvent).toHaveBeenCalledWith(
      adminCtx,
      expect.objectContaining({
        action: 'DOCUMENT_SHARE_LINK_CREATED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-1',
        result: 'SUCCESS',
      }),
    );
  });

  it('rejects creating a share link for a non-existent document', async () => {
    prisma.document.findUnique.mockResolvedValueOnce(null);
    prisma.document.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(
        'missing',
        { permission: 'VIEW', expiresInHours: 1 } as any,
        adminCtx as any,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.documentShareLink.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid expiry window', async () => {
    await expect(
      service.create(
        'doc-1',
        { permission: 'VIEW', expiresInHours: 0 } as any,
        adminCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('forbids non-owner non-admin from creating a share link', async () => {
    await expect(
      service.create(
        'doc-1',
        { permission: 'VIEW', expiresInHours: 1 } as any,
        { ...adminCtx, actorId: 'intruder', roles: ['viewer'] } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lists share links without exposing token hashes', async () => {
    prisma.documentShareLink.findMany.mockResolvedValueOnce([
      {
        id: 'link-1',
        docId: 'doc-1',
        tokenHash: 'secret-hash',
        permission: 'VIEW',
        createdBy: 'owner-1',
        expiresAt: new Date(Date.now() + 3600_000),
        maxAccessCount: null,
        accessCount: 0,
        lastAccessedAt: null,
        revokedAt: null,
        revokedBy: null,
        createdAt: new Date(),
      },
    ]);

    const links = await service.list('doc-1', adminCtx as any);

    expect(links).toHaveLength(1);
    expect(JSON.stringify(links)).not.toContain('secret-hash');
    expect(links[0]).toMatchObject({ id: 'link-1', status: 'ACTIVE' });
  });

  it('revokes a share link and audits the revocation', async () => {
    prisma.documentShareLink.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      docId: 'doc-1',
      createdBy: 'owner-1',
      revokedAt: null,
    });

    await service.revoke('doc-1', 'link-1', adminCtx as any);

    const updateArg = prisma.documentShareLink.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'link-1' });
    expect(updateArg.data.revokedAt).toBeInstanceOf(Date);
    expect(updateArg.data.revokedBy).toBe('owner-1');
    expect(audit.emitEvent).toHaveBeenCalledWith(
      adminCtx,
      expect.objectContaining({
        action: 'DOCUMENT_SHARE_LINK_REVOKED',
        result: 'SUCCESS',
      }),
    );
  });

  describe('redeem', () => {
    function activeLink(overrides: Record<string, any> = {}) {
      return {
        id: 'link-1',
        docId: 'doc-1',
        tokenHash: createHash('sha256').update('rawtoken').digest('hex'),
        permission: 'VIEW',
        createdBy: 'owner-1',
        expiresAt: new Date(Date.now() + 3600_000),
        maxAccessCount: 5,
        accessCount: 0,
        lastAccessedAt: null,
        revokedAt: null,
        revokedBy: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('redeems a valid token, increments access count, and returns doc context', async () => {
      prisma.documentShareLink.findUnique.mockResolvedValueOnce(activeLink());

      const result = await service.redeem('rawtoken', adminCtx as any);

      expect(result).toMatchObject({
        docId: 'doc-1',
        permission: 'VIEW',
        documentTitle: 'Quarterly report',
      });
      expect(prisma.documentShareLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'link-1' },
          data: expect.objectContaining({ accessCount: { increment: 1 } }),
        }),
      );
    });

    it('rejects an expired token', async () => {
      prisma.documentShareLink.findUnique.mockResolvedValueOnce(
        activeLink({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.redeem('rawtoken', adminCtx as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a revoked token', async () => {
      prisma.documentShareLink.findUnique.mockResolvedValueOnce(
        activeLink({ revokedAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.redeem('rawtoken', adminCtx as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a token that exceeded its max access count', async () => {
      prisma.documentShareLink.findUnique.mockResolvedValueOnce(
        activeLink({ maxAccessCount: 3, accessCount: 3 }),
      );
      await expect(service.redeem('rawtoken', adminCtx as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects an unknown token', async () => {
      prisma.documentShareLink.findUnique.mockResolvedValueOnce(null);
      await expect(service.redeem('nope', adminCtx as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
