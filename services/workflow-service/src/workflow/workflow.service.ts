import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';
import { MetadataClient } from '../metadata/metadata.client';
import { NotificationClient } from '../notification/notification.client';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly metadataClient: MetadataClient,
    private readonly notificationClient: NotificationClient,
  ) {}

  async submit(docId: string, user: ServiceUser, context: RequestContext) {
    const document = await this.metadataClient.getDocument(docId, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];

    if (
      (!roles.includes('editor') && !roles.includes('admin')) ||
      (document.ownerId !== actorId && !roles.includes('admin'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can submit a document',
      );
    }

    if (document.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT documents can be submitted');
    }

    const updated = await this.metadataClient.updateStatus(
      docId,
      'PENDING',
      'SUBMIT',
      context,
    );

    // SUBMITTED → notify every approver and admin
    const { userIds: approverIds } = await this.metadataClient.getApprovers(context);
    await this.notificationClient.notify(context, {
      type:         'SUBMITTED',
      docId,
      recipientIds: approverIds,
      docTitle:     document.title,
    });

    return updated;
  }

  async approve(docId: string, user: ServiceUser, context: RequestContext) {
    const document = await this.metadataClient.getDocument(docId, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];

    if (!roles.includes('approver') && !roles.includes('admin')) {
      throw new ForbiddenException('Only approver or admin can approve');
    }

    if (document.status !== 'PENDING') {
      throw new ConflictException('Only PENDING documents can be approved');
    }

    const updated = await this.metadataClient.updateStatus(
      docId,
      'PUBLISHED',
      'APPROVE',
      context,
    );

    await this.notificationClient.notify(context, {
      type:        'APPROVED',
      docId,
      recipientId: document.ownerId,
      docTitle:    document.title,
    });

    return updated;
  }

  async reject(
    docId: string,
    reason: string | undefined,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.metadataClient.getDocument(docId, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];

    if (!roles.includes('approver') && !roles.includes('admin')) {
      throw new ForbiddenException('Only approver or admin can reject');
    }

    if (document.status !== 'PENDING') {
      throw new ConflictException('Only PENDING documents can be rejected');
    }

    const updated = await this.metadataClient.updateStatus(
      docId,
      'DRAFT',
      'REJECT',
      context,
      reason,
    );

    await this.notificationClient.notify(context, {
      type:        'REJECTED',
      docId,
      recipientId: document.ownerId,
      docTitle:    document.title,
      reason,
    });

    return updated;
  }

  async archive(docId: string, user: ServiceUser, context: RequestContext) {
    const document = await this.metadataClient.getDocument(docId, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];

    if (
      (!roles.includes('editor') && !roles.includes('admin')) ||
      (document.ownerId !== actorId && !roles.includes('admin'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can archive a document',
      );
    }

    if (document.status !== 'PUBLISHED') {
      throw new ConflictException('Only PUBLISHED documents can be archived');
    }

    const updated = await this.metadataClient.updateStatus(
      docId,
      'ARCHIVED',
      'ARCHIVE',
      context,
    );

    await this.notificationClient.notify(context, {
      type:        'ARCHIVED',
      docId,
      recipientId: document.ownerId,
      docTitle:    document.title,
    });

    return updated;
  }

  async delete(docId: string, user: ServiceUser, context: RequestContext) {
    const document = await this.metadataClient.getDocument(docId, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];

    // Ownership / role guard: only owner or admin can delete
    if (
      document.ownerId !== actorId &&
      !roles.includes('admin')
    ) {
      throw new ForbiddenException(
        'Only the document owner or admin can delete a document',
      );
    }

    // Status guard: only DRAFT documents can be deleted
    if (document.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT documents can be deleted');
    }

    // Transition: DRAFT → DELETED (handled by StatusService)
    await this.metadataClient.updateStatus(
      docId,
      'DELETED',
      'DELETE',
      context,
    );

    // Notify stakeholders (fire-and-forget)
    await this.notificationClient.notify(context, {
      type:        'DELETED',
      docId,
      recipientId: document.ownerId,
      docTitle:    document.title,
    });

    return { success: true };
  }
}
