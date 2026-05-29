import { ForbiddenException } from '@nestjs/common';
import { AclEffect, ClassificationLevel } from '../../generated/prisma';
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
});
