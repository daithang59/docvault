import { ForbiddenException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';

describe('DocumentsController comment mutation policy', () => {
  const user = { sub: 'author-1', roles: ['editor'] };
  const req = {
    user,
    headers: {
      authorization: 'Bearer token',
    },
    traceId: 'trace-1',
    ip: '127.0.0.1',
  };
  const mockAssertCanReadMetadata = jest.fn();
  const mockUpdateComment = jest.fn();
  const mockDeleteComment = jest.fn();
  let controller: DocumentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertCanReadMetadata.mockResolvedValue({ id: 'doc-1' });
    mockUpdateComment.mockResolvedValue({ id: 'comment-1', content: 'Updated' });
    mockDeleteComment.mockResolvedValue(undefined);

    controller = new DocumentsController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { assertCanReadMetadata: mockAssertCanReadMetadata } as any,
      {
        update: mockUpdateComment,
        delete: mockDeleteComment,
      } as any,
      {} as any,
    );
  });

  it('denies author comment updates when document metadata is no longer readable', async () => {
    mockAssertCanReadMetadata.mockRejectedValue(
      new ForbiddenException('Metadata read denied by ACL'),
    );

    await expect(
      controller.updateComment(
        'doc-1',
        'comment-1',
        { content: 'Updated' },
        req,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAssertCanReadMetadata).toHaveBeenCalledWith(
      'doc-1',
      user,
      expect.objectContaining({
        actorId: 'author-1',
        roles: ['editor'],
      }),
    );
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('denies author comment deletes when document metadata is no longer readable', async () => {
    mockAssertCanReadMetadata.mockRejectedValue(
      new ForbiddenException('Metadata read denied by ACL'),
    );

    await expect(
      controller.deleteComment('doc-1', 'comment-1', req),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAssertCanReadMetadata).toHaveBeenCalledWith(
      'doc-1',
      user,
      expect.objectContaining({
        actorId: 'author-1',
        roles: ['editor'],
      }),
    );
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });

  it('passes the route document id into comment updates after policy allows', async () => {
    await controller.updateComment(
      'doc-1',
      'comment-1',
      { content: 'Updated' },
      req,
    );

    expect(mockUpdateComment).toHaveBeenCalledWith(
      'doc-1',
      'comment-1',
      'Updated',
      user,
      expect.objectContaining({
        actorId: 'author-1',
        roles: ['editor'],
      }),
    );
  });

  it('passes the route document id into comment deletes after policy allows', async () => {
    await controller.deleteComment('doc-1', 'comment-1', req);

    expect(mockDeleteComment).toHaveBeenCalledWith(
      'doc-1',
      'comment-1',
      user,
      expect.objectContaining({
        actorId: 'author-1',
        roles: ['editor'],
      }),
    );
  });
});
