// dotenv MUST be loaded before any NestJS modules are imported, because
// JwtStrategy is constructed during AuthModule initialization — which happens
// before bootstrap() runs. Without this, KEYCLOAK_BASE_URL and KEYCLOAK_REALM
// are undefined when the strategy reads them, causing every JWT to be rejected.
import * as dotenv from 'dotenv';
dotenv.config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { HttpExceptionFilter } from './common/http-exception.filter';

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
    });
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('DocVault Gateway')
    .setVersion('0.1.0')
    .setDescription(
      'API Gateway for the DocVault document management system.\n\n' +
        '## Authentication\n\n' +
        '**Development (localhost):** Use **Cookie Auth** — JWT is set via the `dv_access_token` ' +
        'cookie after logging in through `/api/auth/login`.\n\n' +
        '**Production:** Use **Bearer Token** — JWT from Keycloak, sent with the header:\n' +
        '`Authorization: Bearer <token>`\n\n' +
        '## Roles\n\n' +
        '| Role | Description |\n' +
        '|------|------------|\n' +
        '| `viewer` | View document list, download published files |\n' +
        '| `editor` | Create, upload, submit, archive documents |\n' +
        '| `approver` | Approve / reject documents |\n' +
        '| `compliance_officer` | View audit log |\n' +
        '| `admin` | Full access |\n\n' +
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
