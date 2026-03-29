import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

export type NotificationType =
  | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'DELETED';

export interface NotificationPayload {
  type:         NotificationType;
  docId:        string;
  recipientId?:   string;    // single recipient
  recipientIds?: string[];   // multi-recipient
  docTitle?:    string;
  reason?:      string;
}

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);
  private readonly baseUrl = process.env.NOTIFICATION_SERVICE_URL;

  constructor(private readonly http: HttpService) {}

  async notify(context: RequestContext, body: NotificationPayload) {
    if (!this.baseUrl) {
      this.logger.warn('NOTIFICATION_SERVICE_URL not set — skipping notification');
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/notify`,
          {
            type:         body.type,
            docId:        body.docId,
            recipientId:   body.recipientId,
            recipientIds:  body.recipientIds,
            docTitle:     body.docTitle,
            reason:       body.reason,
            traceId:      context.traceId,
          },
          {
            headers: {
              authorization:  context.authorization,
              'x-request-id': context.traceId,
              'x-user-id':   context.actorId,
              'x-roles':     context.roles.join(','),
            },
          },
        ),
      );
    } catch (error) {
      // Fire-and-forget: never throw. Workflow must not fail because notifications failed.
      this.logger.warn(`Notification emit failed: ${(error as Error).message}`);
    }
  }
}
