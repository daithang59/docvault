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
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditClient {
  private readonly logger = new Logger(AuditClient.name);

  constructor(private readonly http: HttpService) {}

  private get baseUrl(): string | undefined {
    return process.env.AUDIT_SERVICE_URL;
  }

  async emitEvent(context: RequestContext, event: AuditEventPayload) {
    const url = this.baseUrl;
    if (!url) {
      this.logger.warn(
        `AUDIT_SERVICE_URL not set — audit event "${event.action}" dropped`,
      );
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${url}/audit/events`,
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
            ...(event.metadata !== undefined && { metadata: event.metadata }),
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
