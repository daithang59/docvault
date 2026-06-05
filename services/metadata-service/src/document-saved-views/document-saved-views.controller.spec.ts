import { DocumentSavedViewsController } from './document-saved-views.controller';
import { DocumentSavedViewScope } from './dto/create-document-saved-view.dto';

describe('DocumentSavedViewsController', () => {
  const req = {
    user: { sub: 'user-1', roles: ['viewer'] },
    headers: {
      authorization: 'Bearer token',
    },
    traceId: 'trace-1',
    ip: '127.0.0.1',
  };
  const mockCreate = jest.fn();
  const mockFindAll = jest.fn();
  const mockDelete = jest.fn();
  let controller: DocumentSavedViewsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DocumentSavedViewsController({
      create: mockCreate,
      findAll: mockFindAll,
      delete: mockDelete,
    } as any);
  });

  it('passes request context into saved view creation', async () => {
    const body = {
      name: 'My pending',
      filters: { status: ['PENDING'] },
      scope: DocumentSavedViewScope.PRIVATE,
    };

    await controller.create(body, req);

    expect(mockCreate).toHaveBeenCalledWith(
      body,
      expect.objectContaining({
        actorId: 'user-1',
        roles: ['viewer'],
        authorization: 'Bearer token',
        traceId: 'trace-1',
      }),
    );
  });

  it('passes request context into saved view listing', async () => {
    await controller.findAll(req);

    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        roles: ['viewer'],
      }),
    );
  });

  it('passes route id and request context into saved view deletion', async () => {
    await controller.delete('view-1', req);

    expect(mockDelete).toHaveBeenCalledWith(
      'view-1',
      expect.objectContaining({
        actorId: 'user-1',
        roles: ['viewer'],
      }),
    );
  });
});
