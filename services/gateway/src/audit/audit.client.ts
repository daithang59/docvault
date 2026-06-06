import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

type AuditEventPayload = {
  action: string;
  resourceType: string;
  resourceId?: string;
  result: 'SUCCESS' | 'DENY' | 'CONFLICT' | 'ERROR';
  reason?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class GatewayAuditClient {
  private readonly logger = new Logger(GatewayAuditClient.name);

  constructor(private readonly http: HttpService) {}

  private get baseUrl(): string | undefined {
    return process.env.AUDIT_SERVICE_URL;
  }

  private get ingestToken(): string | undefined {
    return process.env.AUDIT_INGEST_TOKEN;
  }

  async emitEvent(req: any, event: AuditEventPayload): Promise<void> {
    const url = this.baseUrl;
    if (!url) {
      this.logger.warn(
        `AUDIT_SERVICE_URL not set - audit event "${event.action}" dropped`,
      );
      return;
    }

    const ingestToken = this.ingestToken;
    if (!ingestToken) {
      this.logger.warn(
        `AUDIT_INGEST_TOKEN not set - audit event "${event.action}" dropped`,
      );
      return;
    }

    const traceId = req?.traceId ?? req?.headers?.['x-request-id'];
    const actorId = req?.user?.sub ?? req?.user?.username ?? 'unknown';
    const roles = Array.isArray(req?.user?.roles) ? req.user.roles : [];

    try {
      await firstValueFrom(
        this.http.post(
          `${url}/audit/events`,
          {
            timestamp: new Date().toISOString(),
            actorId,
            actorRoles: roles,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            result: event.result,
            reason: event.reason,
            ip: req?.ip,
            traceId,
            ...(event.metadata !== undefined && { metadata: event.metadata }),
          },
          {
            headers: {
              'x-docvault-service-token': ingestToken,
              ...(traceId && { 'x-request-id': traceId }),
              'x-user-id': actorId,
              'x-roles': roles.join(','),
            },
          },
        ),
      );
    } catch (error) {
      this.logger.warn(`Audit emit failed: ${(error as Error).message}`);
    }
  }
}
