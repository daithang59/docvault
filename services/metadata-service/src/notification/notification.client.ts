import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

type NotifyPayload = {
  type: 'MENTIONED' | 'COMMENTED' | 'VERSION_UPLOADED' | 'DLP_DETECTED';
  docId: string;
  recipientIds?: string[];
  recipientId?: string;
  docTitle?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);

  constructor(private readonly http: HttpService) {}

  private get baseUrl(): string | undefined {
    return process.env.NOTIFICATION_SERVICE_URL;
  }

  async notify(context: RequestContext, payload: NotifyPayload): Promise<void> {
    const url = this.baseUrl;
    if (!url) {
      this.logger.warn(
        `NOTIFICATION_SERVICE_URL not set — notification "${payload.type}" dropped`,
      );
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${url}/notify`,
          {
            type: payload.type,
            docId: payload.docId,
            recipientId: payload.recipientId,
            recipientIds: payload.recipientIds,
            docTitle: payload.docTitle,
            traceId: context.traceId,
            metadata: payload.metadata,
          },
          {
            headers: {
              authorization: context.authorization,
              'x-request-id': context.traceId,
              'x-user-id': context.actorId,
              'x-roles': context.roles.join(','),
            },
          },
        ),
      );
    } catch (error) {
      this.logger.warn(`Notification emit failed: ${(error as Error).message}`);
    }
  }
}
