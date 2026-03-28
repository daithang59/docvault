import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { HttpExceptionFilter } from './common/http-exception.filter';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const serviceName = 'gateway';

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [
      'http://localhost:3006',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-ID',
      'X-User-ID',
      'X-Roles',
    ],
  });

  // Intercept OPTIONS preflight BEFORE guards run — guards would reject the
  // preflight with 401 because no Authorization header is present on CORS
  // preflight requests.
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((s) =>
    s.trim(),
  ) ?? ['http://localhost:3006'];
  app.use((req: any, res: any, next: () => void) => {
    if (req.method === 'OPTIONS') {
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.headers.origin ?? allowedOrigins[0],
      );
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,X-Request-ID,X-User-ID,X-Roles',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).send();
      return;
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: any, res: any, next: () => void) => {
    const traceId = req.headers['x-request-id'] || randomUUID();
    const startedAt = Date.now();
    req.traceId = traceId;
    res.setHeader('x-request-id', traceId);
    res.on('finish', async () => {
      const actorId =
        req.user?.username ??
        req.user?.sub ??
        req.headers['x-user-id'];

      // Skip audit for unauthenticated requests — no value in logging anonymous actors
      if (!actorId) return;
      const roles = (req.user?.roles ?? []) as string[];
      const result =
        res.statusCode >= 500
          ? 'ERROR'
          : res.statusCode >= 400
            ? 'DENY'
            : 'SUCCESS';

      console.log(
        JSON.stringify({
          traceId,
          service: serviceName,
          route: req.originalUrl,
          actorId,
          action: `${req.method} ${req.originalUrl}`,
          result,
          latencyMs: Date.now() - startedAt,
        }),
      );

      const auditServiceUrl = process.env.AUDIT_SERVICE_URL;
      if (!auditServiceUrl) {
        return;
      }

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-request-id': traceId,
        'x-user-id': actorId,
        'x-roles': roles.join(','),
      };

      // Forward JWT — from Authorization header or dv_access_token cookie
      let authHeader = req.headers.authorization;
      if (!authHeader) {
        const rawCookies = (req.headers.cookie ?? '') as string;
        const cookieToken = rawCookies
          .split(';')
          .map((c: string) => c.trim().split('='))
          .find(([k]: string[]) => k === 'dv_access_token')?.[1];
        if (cookieToken) {
          authHeader = `Bearer ${decodeURIComponent(cookieToken)}`;
        }
      }
      if (authHeader) {
        headers.authorization = authHeader;
      }

      const baseEvent = {
        actorId,
        actorRoles: roles,
        resourceType: 'HTTP_ROUTE',
        resourceId: req.originalUrl,
        ip: req.ip,
        traceId,
      };

      try {
        await fetch(`${auditServiceUrl}/audit/events`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...baseEvent,
            action: 'REQUEST_RECEIVED',
            result: 'SUCCESS',
            timestamp: new Date().toISOString(),
          }),
        });
        if (res.statusCode < 400) {
          await fetch(`${auditServiceUrl}/audit/events`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...baseEvent,
              action: 'REQUEST_OK',
              result: 'SUCCESS',
              timestamp: new Date().toISOString(),
            }),
          });
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          await fetch(`${auditServiceUrl}/audit/events`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...baseEvent,
              action: 'REQUEST_DENIED',
              result: 'DENY',
              reason: `HTTP ${res.statusCode}`,
              timestamp: new Date().toISOString(),
            }),
          });
        }
      } catch {
        // swallow audit wrapper failures to avoid blocking the gateway response
      }
    });
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('DocVault Gateway')
    .setVersion('0.1.0')
    .setDescription(
      'API Gateway cho hệ thống DocVault.\n\n' +
        '## Authentication\n\n' +
        '**Development (localhost):** Sử dụng **Cookie Auth** — JWT được set qua cookie `dv_access_token` ' +
        'sau khi đăng nhập qua `/api/auth/login`.\n\n' +
        '**Production:** Sử dụng **Bearer Token** — JWT từ Keycloak, gửi kèm header:\n' +
        '`Authorization: Bearer <token>`\n\n' +
        '## Roles\n\n' +
        '| Role | Mô tả |\n' +
        '|------|--------|\n' +
        '| `viewer` | Xem danh sách, tải file đã xuất bản |\n' +
        '| `editor` | Tạo, upload, submit, archive tài liệu |\n' +
        '| `approver` | Duyệt / từ chối tài liệu |\n' +
        '| `compliance_officer` | Xem audit log |\n' +
        '| `admin` | Toàn quyền |\n\n' +
        '## Document Lifecycle\n\n' +
        '`DRAFT → PENDING → PUBLISHED → ARCHIVED`',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addCookieAuth(
      'dv_access_token',
      { type: 'apiKey', in: 'cookie', name: 'dv_access_token' },
      'cookie',
    )
    .addTag(
      'auth',
      'Keycloak OIDC authentication endpoints (development SSO flow)',
    )
    .addTag('app', 'Health check and session info')
    .addTag(
      'metadata-proxy',
      'Proxy to metadata-service: documents, ACL, metadata',
    )
    .addTag(
      'documents-proxy',
      'Proxy to document-service: upload, download, presign URLs',
    )
    .addTag(
      'workflow-proxy',
      'Proxy to workflow-service: submit, approve, reject, archive',
    )
    .addTag(
      'audit-proxy',
      'Proxy to audit-service: audit events and chain verification',
    )
    .addTag('notify-proxy', 'Proxy to notification-service: notifications')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
