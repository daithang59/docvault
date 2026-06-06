import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrgService } from './org.service';

describe('OrgService member mutations', () => {
  const ORG = 'org-1';
  const adminCtx = {
    traceId: 't',
    actorId: 'admin-1',
    roles: ['admin'],
    authorization: 'Bearer x',
    ip: '127.0.0.1',
  } as any;

  let findFirst: jest.Mock;
  let findUnique: jest.Mock;
  let update: jest.Mock;
  let del: jest.Mock;
  let count: jest.Mock;
  let emitEvent: jest.Mock;
  let service: OrgService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Membership lookup used by requireOrgId() to resolve the caller's org.
    findFirst = jest.fn().mockResolvedValue({ organizationId: ORG });
    findUnique = jest.fn();
    update = jest.fn();
    del = jest.fn();
    count = jest.fn();
    emitEvent = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      organizationMembership: {
        findFirst,
        findUnique,
        update,
        delete: del,
        count,
      },
    } as any;

    service = new OrgService(prisma, { emitEvent } as any);
  });

  describe('updateMemberRole', () => {
    it('promotes a member to admin and audits the change', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'user-2',
        role: 'MEMBER',
      });
      update.mockResolvedValue({
        userId: 'user-2',
        role: 'ADMIN',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const result = await service.updateMemberRole(
        adminCtx,
        'user-2',
        'ADMIN',
      );

      expect(result).toMatchObject({ userId: 'user-2', role: 'ADMIN' });
      expect(update).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: ORG, userId: 'user-2' },
        },
        data: { role: 'ADMIN' },
      });
      expect(emitEvent).toHaveBeenCalledWith(
        adminCtx,
        expect.objectContaining({
          action: 'ORG_MEMBER_ROLE_CHANGED',
          result: 'SUCCESS',
          resourceId: 'user-2',
          metadata: expect.objectContaining({
            organizationId: ORG,
            fromRole: 'MEMBER',
            toRole: 'ADMIN',
          }),
        }),
      );
    });

    it('throws when the target member is not in the org', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(adminCtx, 'ghost', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('refuses to demote the last remaining admin', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'admin-1',
        role: 'ADMIN',
      });
      count.mockResolvedValue(1); // only one admin left

      await expect(
        service.updateMemberRole(adminCtx, 'admin-1', 'MEMBER'),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('allows demoting an admin when another admin remains', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'admin-2',
        role: 'ADMIN',
      });
      count.mockResolvedValue(2);
      update.mockResolvedValue({
        userId: 'admin-2',
        role: 'MEMBER',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const result = await service.updateMemberRole(
        adminCtx,
        'admin-2',
        'MEMBER',
      );

      expect(result.role).toBe('MEMBER');
      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('removes a member and audits the removal', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'user-2',
        role: 'MEMBER',
      });
      del.mockResolvedValue({});

      const result = await service.removeMember(adminCtx, 'user-2');

      expect(result).toEqual({ userId: 'user-2', removed: true });
      expect(del).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: ORG, userId: 'user-2' },
        },
      });
      expect(emitEvent).toHaveBeenCalledWith(
        adminCtx,
        expect.objectContaining({
          action: 'ORG_MEMBER_REMOVED',
          result: 'SUCCESS',
          resourceId: 'user-2',
          metadata: expect.objectContaining({
            organizationId: ORG,
            removedRole: 'MEMBER',
          }),
        }),
      );
    });

    it('throws when the member does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.removeMember(adminCtx, 'ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(del).not.toHaveBeenCalled();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('refuses to remove the last remaining admin', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'admin-1',
        role: 'ADMIN',
      });
      count.mockResolvedValue(1);

      await expect(service.removeMember(adminCtx, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(del).not.toHaveBeenCalled();
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('removes an admin when another admin remains', async () => {
      findUnique.mockResolvedValue({
        organizationId: ORG,
        userId: 'admin-2',
        role: 'ADMIN',
      });
      count.mockResolvedValue(2);
      del.mockResolvedValue({});

      const result = await service.removeMember(adminCtx, 'admin-2');

      expect(result.removed).toBe(true);
      expect(emitEvent).toHaveBeenCalled();
    });
  });
});
