import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);
  private readonly baseUrl = process.env.NOTIFICATION_SERVICE_URL;

  constructor(private readonly http: HttpService) {}

  async notify(
    context: RequestContext,
    body: {
      type: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
      docId: string;
      actorId: string;
      reason?: string;
    },
  ) {
    if (!this.baseUrl) {
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/notify`,
          {
            ...body,
            traceId: context.traceId,
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
