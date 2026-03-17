import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AuditClient } from '../audit/audit.client';
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
    private readonly auditClient: AuditClient,
    private readonly notificationClient: NotificationClient,
  ) {}

  async submit(docId: string, user: ServiceUser, context: RequestContext) {
    try {
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

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_SUBMITTED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
      });
      await this.notificationClient.notify(context, {
        type: 'SUBMITTED',
        docId,
        actorId,
      });

      return updated;
    } catch (error) {
      await this.auditWorkflowError(
        docId,
        context,
        'DOCUMENT_SUBMITTED',
        error,
      );
      throw error;
    }
  }

  async approve(docId: string, user: ServiceUser, context: RequestContext) {
    try {
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

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_APPROVED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
      });
      await this.notificationClient.notify(context, {
        type: 'APPROVED',
        docId,
        actorId,
      });

      return updated;
    } catch (error) {
      await this.auditWorkflowError(docId, context, 'DOCUMENT_APPROVED', error);
      throw error;
    }
  }

  async reject(
    docId: string,
    reason: string | undefined,
    user: ServiceUser,
    context: RequestContext,
  ) {
    try {
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

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_REJECTED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
        reason,
      });
      await this.notificationClient.notify(context, {
        type: 'REJECTED',
        docId,
        actorId,
        reason,
      });

      return updated;
    } catch (error) {
      await this.auditWorkflowError(docId, context, 'DOCUMENT_REJECTED', error);
      throw error;
    }
  }

  async archive(docId: string, user: ServiceUser, context: RequestContext) {
    try {
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

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_ARCHIVED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
      });
      await this.notificationClient.notify(context, {
        type: 'ARCHIVED',
        docId,
        actorId,
      });

      return updated;
    } catch (error) {
      await this.auditWorkflowError(docId, context, 'DOCUMENT_ARCHIVED', error);
      throw error;
    }
  }

  private async auditWorkflowError(
    docId: string,
    context: RequestContext,
    action: string,
    error: unknown,
  ) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;

    await this.auditClient.emitEvent(context, {
      action,
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result:
        status === 409
          ? 'CONFLICT'
          : status && status >= 400 && status < 500
            ? 'DENY'
            : 'ERROR',
      reason:
        axiosError.response?.data?.message?.[0] ??
        axiosError.response?.data?.message ??
        (error as Error).message,
    });
  }
}
