import { createHmac } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import {
  AclEffect,
  AclSubjectType,
  ClassificationLevel,
  DocumentPermission,
} from '../../generated/prisma';
import { PolicyService } from './policy.service';

const mockDocumentFindUnique = jest.fn();
const mockVersionFindUnique = jest.fn();
const mockEmitEvent = jest.fn().mockResolvedValue(undefined);

const mockPrisma = {
  document: {
    findUnique: mockDocumentFindUnique,
  },
  documentVersion: {
    findUnique: mockVersionFindUnique,
  },
};

const auditClient = {
  emitEvent: mockEmitEvent,
};

const baseContext = {
  traceId: 'trace-1',
  actorId: 'viewer-1',
  roles: ['viewer'],
  authorization: 'Bearer token',
  ip: '127.0.0.1',
};

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    ownerId: 'editor-1',
    status: 'PUBLISHED',
    classification: ClassificationLevel.PUBLIC,
    currentVersion: 1,
    aclEntries: [],
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    docId: 'doc-1',
    version: 1,
    objectKey: 'doc/doc-1/v1/file.pdf',
    filename: 'file.pdf',
    contentType: 'application/pdf',
    size: 1024,
    checksum: 'sha256:abc',
    ...overrides,
  };
}

describe('PolicyService', () => {
  let service: PolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    process.env.PREVIEW_GRANT_SECRET = 'test-preview-secret';
    service = new PolicyService(mockPrisma as any, auditClient as any);
    mockDocumentFindUnique.mockResolvedValue(makeDocument());
    mockVersionFindUnique.mockResolvedValue(makeVersion());
  });

  afterEach(() => {
    delete process.env.DOWNLOAD_GRANT_SECRET;
    delete process.env.PREVIEW_GRANT_SECRET;
    delete process.env.GRANT_TOKEN_CURRENT_KID;
    delete process.env.GRANT_TOKEN_PREVIOUS_KID;
    delete process.env.DOWNLOAD_GRANT_SECRET_2026_05;
    delete process.env.PREVIEW_GRANT_SECRET_2026_05;
  });

  it('denies compliance officers from previewing file content', async () => {
    await expect(
      service.authorizePreview(
        'doc-1',
        { version: 1 },
        { sub: 'co-1', roles: ['compliance_officer'] },
        {
          ...baseContext,
          actorId: 'co-1',
          roles: ['compliance_officer'],
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies compliance officers from downloading file content', async () => {
    await expect(
      service.authorizeDownload(
        'doc-1',
        { version: 1 },
        { sub: 'co-1', roles: ['compliance_officer'] },
        {
          ...baseContext,
          actorId: 'co-1',
          roles: ['compliance_officer'],
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('signs download grants with the current kid when rotation env is configured', async () => {
    delete process.env.DOWNLOAD_GRANT_SECRET;
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.DOWNLOAD_GRANT_SECRET_2026_05 = 'current-download-secret';

    const result = await service.authorizeDownload(
      'doc-1',
      { version: 1 },
      { sub: 'viewer-1', roles: ['viewer'] },
      baseContext,
    );

    const [encodedPayload, signature] = result.grantToken.split('.');
    const tokenPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
    const expectedSignature = createHmac('sha256', 'current-download-secret')
      .update(encodedPayload)
      .digest('base64url');

    expect(tokenPayload.kid).toBe('2026_05');
    expect(signature).toBe(expectedSignature);
  });

  it('signs preview grants with the current kid when rotation env is configured', async () => {
    delete process.env.PREVIEW_GRANT_SECRET;
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.PREVIEW_GRANT_SECRET_2026_05 = 'current-preview-secret';

    const result = await service.authorizePreview(
      'doc-1',
      { version: 1 },
      { sub: 'viewer-1', roles: ['viewer'] },
      baseContext,
    );

    const [encodedPayload, signature] = result.grantToken.split('.');
    const tokenPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
    const expectedSignature = createHmac('sha256', 'current-preview-secret')
      .update(encodedPayload)
      .digest('base64url');

    expect(tokenPayload.kid).toBe('2026_05');
    expect(signature).toBe(expectedSignature);
  });

  it('allows viewer metadata read for a published public document', async () => {
    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'viewer-1', roles: ['viewer'] },
        baseContext,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'doc-1' }));
  });

  it('denies guessed confidential metadata detail without owner or ACL access', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.CONFIDENTIAL,
        aclEntries: [
          {
            subjectType: 'USER',
            subjectId: 'other-user',
            permission: 'READ',
            effect: AclEffect.ALLOW,
          },
        ],
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'viewer-1', roles: ['viewer'] },
        baseContext,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows approver metadata read for pending documents', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        status: 'PENDING',
        classification: ClassificationLevel.CONFIDENTIAL,
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'approver-1', roles: ['approver'] },
        {
          ...baseContext,
          actorId: 'approver-1',
          roles: ['approver'],
        },
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'doc-1' }));
  });

  it('allows confidential metadata read through a matching GROUP READ allow', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.CONFIDENTIAL,
        aclEntries: [
          {
            subjectType: AclSubjectType.GROUP,
            subjectId: 'finance-team',
            permission: DocumentPermission.READ,
            effect: AclEffect.ALLOW,
          },
        ],
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'viewer-1', roles: ['viewer'], groups: ['finance-team'] } as any,
        { ...baseContext, groups: ['finance-team'] } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'doc-1' }));
  });

  it('denies metadata read through a matching GROUP READ deny', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.INTERNAL,
        aclEntries: [
          {
            subjectType: AclSubjectType.GROUP,
            subjectId: 'blocked-team',
            permission: DocumentPermission.READ,
            effect: AclEffect.DENY,
          },
        ],
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'viewer-1', roles: ['viewer'], groups: ['blocked-team'] } as any,
        { ...baseContext, groups: ['blocked-team'] } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies admin metadata read through a matching GROUP READ deny', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.INTERNAL,
        aclEntries: [
          {
            subjectType: AclSubjectType.GROUP,
            subjectId: 'blocked-team',
            permission: DocumentPermission.READ,
            effect: AclEffect.DENY,
          },
        ],
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'admin-1', roles: ['admin'], groups: ['blocked-team'] } as any,
        {
          ...baseContext,
          actorId: 'admin-1',
          roles: ['admin'],
          groups: ['blocked-team'],
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('matches slash-prefixed GROUP READ allow ACL subject ids', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.CONFIDENTIAL,
        aclEntries: [
          {
            subjectType: AclSubjectType.GROUP,
            subjectId: '/finance-team',
            permission: DocumentPermission.READ,
            effect: AclEffect.ALLOW,
          },
        ],
      }),
    );

    await expect(
      (service as any).assertCanReadMetadata(
        'doc-1',
        { sub: 'viewer-1', roles: ['viewer'], groups: ['finance-team'] } as any,
        { ...baseContext, groups: ['finance-team'] } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'doc-1' }));
  });

  it('allows confidential download through a matching GROUP DOWNLOAD allow when role policy also matches', async () => {
    mockDocumentFindUnique.mockResolvedValue(
      makeDocument({
        classification: ClassificationLevel.CONFIDENTIAL,
        ownerId: 'other-editor',
        aclEntries: [
          {
            subjectType: AclSubjectType.GROUP,
            subjectId: 'finance-team',
            permission: DocumentPermission.DOWNLOAD,
            effect: AclEffect.ALLOW,
          },
        ],
      }),
    );

    const result = await service.authorizeDownload(
      'doc-1',
      { version: 1 },
      { sub: 'editor-1', roles: ['editor'], groups: ['finance-team'] } as any,
      {
        ...baseContext,
        actorId: 'editor-1',
        roles: ['editor'],
        groups: ['finance-team'],
      } as any,
    );

    expect(result.grantToken).toEqual(expect.any(String));
  });
});
