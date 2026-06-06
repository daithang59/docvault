import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentSavedViewsService } from './document-saved-views.service';
import { DocumentSavedViewScope } from './dto/create-document-saved-view.dto';

describe('DocumentSavedViewsService', () => {
  const privateView = {
    id: 'view-private-1',
    name: 'My pending',
    description: 'Pending work',
    filters: { status: ['PENDING'] },
    scope: 'PRIVATE',
    ownerId: 'user-1',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };
  const teamView = {
    id: 'view-team-1',
    name: 'Team confidential',
    description: null,
    filters: { classification: ['CONFIDENTIAL'] },
    scope: 'TEAM',
    ownerId: 'admin-owner',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };
  const context = {
    traceId: 'trace-1',
    actorId: 'user-1',
    roles: ['viewer'],
    groups: [],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockDelete = jest.fn();
  let service: DocumentSavedViewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue(privateView);
    mockFindMany.mockResolvedValue([teamView, privateView]);
    mockFindUnique.mockResolvedValue(privateView);
    mockDelete.mockResolvedValue(privateView);

    service = new DocumentSavedViewsService({
      documentSavedView: {
        create: mockCreate,
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        delete: mockDelete,
      },
    } as any);
  });

  it('creates a private saved view owned by the current actor', async () => {
    const result = await service.create(
      {
        name: 'My pending',
        description: 'Pending work',
        filters: { status: ['PENDING'] },
        scope: DocumentSavedViewScope.PRIVATE,
      },
      context,
    );

    expect(result).toBe(privateView);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'My pending',
        description: 'Pending work',
        filters: { status: ['PENDING'] },
        scope: 'PRIVATE',
        ownerId: 'user-1',
      },
    });
  });

  it('rejects team saved view creation for non-admin users', async () => {
    await expect(
      service.create(
        {
          name: 'Team confidential',
          filters: { classification: ['CONFIDENTIAL'] },
          scope: DocumentSavedViewScope.TEAM,
        },
        context,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows admins to create team saved views', async () => {
    mockCreate.mockResolvedValue(teamView);

    const result = await service.create(
      {
        name: 'Team confidential',
        filters: { classification: ['CONFIDENTIAL'] },
        scope: DocumentSavedViewScope.TEAM,
      },
      { ...context, actorId: 'admin-owner', roles: ['admin'] },
    );

    expect(result).toBe(teamView);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Team confidential',
        description: undefined,
        filters: { classification: ['CONFIDENTIAL'] },
        scope: 'TEAM',
        ownerId: 'admin-owner',
      },
    });
  });

  it('lists current actor private views plus team views', async () => {
    const result = await service.findAll(context);

    expect(result).toEqual([teamView, privateView]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ scope: 'PRIVATE', ownerId: 'user-1' }, { scope: 'TEAM' }],
      },
      orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
    });
  });

  it('deletes the owner private saved view', async () => {
    const result = await service.delete('view-private-1', context);

    expect(result).toBe(privateView);
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'view-private-1' },
    });
  });

  it('rejects deletion of another user private saved view even for admin', async () => {
    mockFindUnique.mockResolvedValue({ ...privateView, ownerId: 'user-2' });

    await expect(
      service.delete('view-private-1', {
        ...context,
        actorId: 'admin-1',
        roles: ['admin'],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('allows any admin to delete team saved views', async () => {
    mockFindUnique.mockResolvedValue(teamView);
    mockDelete.mockResolvedValue(teamView);

    const result = await service.delete('view-team-1', {
      ...context,
      actorId: 'admin-1',
      roles: ['admin'],
    });

    expect(result).toBe(teamView);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'view-team-1' } });
  });

  it('returns not found when deleting a missing saved view', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(service.delete('missing-view', context)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
