import { NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';

describe('CommentsService document comment pairing', () => {
  const context = {
    traceId: 'trace-1',
    actorId: 'author-1',
    roles: ['editor'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const author = { sub: 'author-1', roles: ['editor'] };
  const admin = { sub: 'admin-1', roles: ['admin'] };
  const comment = {
    id: 'comment-1',
    docId: 'doc-1',
    authorId: 'author-1',
    content: 'Original',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const mockCommentFindUnique = jest.fn();
  const mockCommentFindFirst = jest.fn();
  const mockCommentUpdate = jest.fn();
  const mockCommentDelete = jest.fn();
  const mockEmitEvent = jest.fn().mockResolvedValue(undefined);
  let service: CommentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCommentFindUnique.mockResolvedValue(comment);
    mockCommentFindFirst.mockResolvedValue(comment);
    mockCommentUpdate.mockResolvedValue({
      ...comment,
      content: 'Updated',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    mockCommentDelete.mockResolvedValue(comment);

    service = new CommentsService(
      {
        documentComment: {
          findUnique: mockCommentFindUnique,
          findFirst: mockCommentFindFirst,
          update: mockCommentUpdate,
          delete: mockCommentDelete,
        },
      } as any,
      { emitEvent: mockEmitEvent } as any,
    );
  });

  it('returns not found and does not update when route doc id does not own the comment', async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    mockCommentFindUnique.mockResolvedValue({
      ...comment,
      docId: 'other-doc',
    });

    await expect(
      (service as any).update('doc-1', 'comment-1', 'Updated', author, context),
    ).rejects.toThrow(NotFoundException);

    expect(mockCommentUpdate).not.toHaveBeenCalled();
    expect(mockEmitEvent).not.toHaveBeenCalled();
  });

  it('returns not found and does not delete when route doc id does not own the comment', async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    mockCommentFindUnique.mockResolvedValue({
      ...comment,
      docId: 'other-doc',
    });

    await expect(
      (service as any).delete('doc-1', 'comment-1', author, context),
    ).rejects.toThrow(NotFoundException);

    expect(mockCommentDelete).not.toHaveBeenCalled();
    expect(mockEmitEvent).not.toHaveBeenCalled();
  });

  it('preserves author updates when the route doc id owns the comment', async () => {
    await (service as any).update(
      'doc-1',
      'comment-1',
      'Updated',
      author,
      context,
    );

    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { content: 'Updated' },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        action: 'COMMENT_UPDATED',
        result: 'SUCCESS',
        metadata: expect.objectContaining({
          docId: 'doc-1',
          commentId: 'comment-1',
          authorId: 'author-1',
        }),
      }),
    );
  });

  it('preserves admin deletes when the route doc id owns the comment', async () => {
    await (service as any).delete('doc-1', 'comment-1', admin, {
      ...context,
      actorId: 'admin-1',
      roles: ['admin'],
    });

    expect(mockCommentDelete).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        roles: ['admin'],
      }),
      expect.objectContaining({
        action: 'COMMENT_DELETED',
        result: 'SUCCESS',
        metadata: expect.objectContaining({
          docId: 'doc-1',
          commentId: 'comment-1',
          deletedBy: 'admin-1',
        }),
      }),
    );
  });
});
