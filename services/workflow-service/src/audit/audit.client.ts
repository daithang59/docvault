import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

type AuditEventPayload = {
  action: string;
  resourceType: string;
  resourceId?: string;
  result: 'SUCCESS' | 'DENY' | 'CONFLICT' | 'ERROR';
  reason?: string;
};

@Injectable()
export class AuditClient {
  private readonly logger = new Logger(AuditClient.name);
  private readonly baseUrl = process.env.AUDIT_SERVICE_URL;

  constructor(private readonly http: HttpService) {}

  async emitEvent(context: RequestContext, event: AuditEventPayload) {
    if (!this.baseUrl) {
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/audit/events`,
          {
            timestamp: new Date().toISOString(),
            actorId: context.actorId,
            actorRoles: context.roles,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            result: event.result,
            reason: event.reason,
            ip: context.ip,
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
      this.logger.warn(`Audit emit failed: ${(error as Error).message}`);
    }
  }
}
