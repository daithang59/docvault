import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { NotificationClient } from '../notification/notification.client';
import { parseMentions } from './mentions.util';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
    private readonly notificationClient?: NotificationClient,
  ) {}

  async create(
    docId: string,
    content: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const authorId = buildActorId(user);
    const authorRoles = user.roles ?? [];

    const comment = await this.prisma.documentComment.create({
      data: {
        docId,
        authorId,
        authorRoles,
        content,
      },
    });

    await this.auditClient.emitEvent(context, {
      action: 'COMMENT_ADDED',
      resourceType: 'COMMENT',
      resourceId: comment.id,
      result: 'SUCCESS',
      metadata: {
        docId,
        content,
        authorId,
        authorRoles,
        createdAt: comment.createdAt,
      },
    });

    const mentioned = parseMentions(content).filter(
      (username) => username !== authorId,
    );
    if (mentioned.length > 0 && this.notificationClient) {
      await this.notificationClient.notify(context, {
        type: 'MENTIONED',
        docId,
        recipientIds: mentioned,
        metadata: { commentId: comment.id, mentionedBy: authorId },
      });
    }

    return comment;
  }

  async update(
    docId: string,
    commentId: string,
    content: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const actorId = buildActorId(user);
    const comment = await this.findCommentForDocument(docId, commentId);

    if (comment.authorId !== actorId) {
      await this.auditClient.emitEvent(context, {
        action: 'COMMENT_UPDATE_DENIED',
        resourceType: 'COMMENT',
        resourceId: commentId,
        result: 'DENY',
        reason: 'Only the author can edit their own comment',
        metadata: {
          docId: comment.docId,
          commentId,
          attemptedBy: actorId,
          actualAuthor: comment.authorId,
        },
      });
      throw new ForbiddenException(
        'Only the author can edit their own comment',
      );
    }

    const updated = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: { content },
    });

    await this.auditClient.emitEvent(context, {
      action: 'COMMENT_UPDATED',
      resourceType: 'COMMENT',
      resourceId: commentId,
      result: 'SUCCESS',
      metadata: {
        docId: comment.docId,
        commentId,
        oldContent: comment.content,
        newContent: content,
        authorId: comment.authorId,
        updatedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  async delete(
    docId: string,
    commentId: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const actorId = buildActorId(user);
    const authorRoles = user.roles ?? [];
    const isAdmin = authorRoles.includes('admin');

    const comment = await this.findCommentForDocument(docId, commentId);

    if (comment.authorId !== actorId && !isAdmin) {
      await this.auditClient.emitEvent(context, {
        action: 'COMMENT_DELETE_DENIED',
        resourceType: 'COMMENT',
        resourceId: commentId,
        result: 'DENY',
        reason: 'Only the author or an admin can delete a comment',
        metadata: {
          docId: comment.docId,
          commentId,
          attemptedBy: actorId,
          actualAuthor: comment.authorId,
        },
      });
      throw new ForbiddenException(
        'Only the author or an admin can delete a comment',
      );
    }

    await this.prisma.documentComment.delete({ where: { id: commentId } });

    await this.auditClient.emitEvent(context, {
      action: 'COMMENT_DELETED',
      resourceType: 'COMMENT',
      resourceId: commentId,
      result: 'SUCCESS',
      metadata: {
        docId: comment.docId,
        commentId,
        authorId: comment.authorId,
        deletedBy: actorId,
        deletedAt: new Date().toISOString(),
      },
    });
  }

  async findByDoc(docId: string) {
    return this.prisma.documentComment.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findCommentForDocument(docId: string, commentId: string) {
    const comment = await this.prisma.documentComment.findFirst({
      where: { id: commentId, docId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }
}
