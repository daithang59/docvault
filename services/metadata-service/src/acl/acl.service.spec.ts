import { BadRequestException } from '@nestjs/common';
import {
  AclEffect,
  AclSubjectType,
  DocumentPermission,
} from '../../generated/prisma';
import { AclService } from './acl.service';

describe('AclService', () => {
  const mockDocumentFindUnique = jest.fn();
  const mockAclCreate = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  const context = {
    traceId: 'trace-1',
    actorId: 'admin-1',
    roles: ['admin'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  let service: AclService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentFindUnique.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'editor-1',
    });
    mockAclCreate.mockImplementation(({ data }) => ({
      id: 'acl-1',
      ...data,
    }));
    service = new AclService(
      {
        document: {
          findUnique: mockDocumentFindUnique,
        },
        documentAcl: {
          create: mockAclCreate,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
    );
  });

  it('normalizes slash-prefixed GROUP subject ids before storing ACL rules', async () => {
    await service.upsert(
      'doc-1',
      {
        subjectType: AclSubjectType.GROUP,
        subjectId: '/finance-team',
        permission: DocumentPermission.READ,
        effect: AclEffect.ALLOW,
      },
      { sub: 'admin-1', roles: ['admin'] },
      context,
    );

    expect(mockAclCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: AclSubjectType.GROUP,
        subjectId: 'finance-team',
      }),
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        metadata: expect.objectContaining({
          subjectType: AclSubjectType.GROUP,
          subjectId: 'finance-team',
        }),
      }),
    );
  });

  it.each([
    AclSubjectType.USER,
    AclSubjectType.ROLE,
    AclSubjectType.GROUP,
  ])('rejects empty %s subject ids before storing ACL rules', async (subjectType) => {
    const subjectId =
      subjectType === AclSubjectType.GROUP ? ' / ' : '   ';

    await expect(
      service.upsert(
        'doc-1',
        {
          subjectType,
          subjectId,
          permission: DocumentPermission.READ,
          effect: AclEffect.DENY,
        },
        { sub: 'admin-1', roles: ['admin'] },
        context,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockAclCreate).not.toHaveBeenCalled();
  });
});
