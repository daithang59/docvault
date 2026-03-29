// dotenv MUST be loaded before any NestJS modules are imported, because
// JwtStrategy is constructed during AuthModule initialization — which happens
// before bootstrap() runs. Without this, KEYCLOAK_BASE_URL and KEYCLOAK_REALM
// are undefined when the strategy reads them, causing every JWT to be rejected.
//
// dotenv.config() with no path: loads .env from CWD.
// When pnpm dev/build runs from project root, this finds the root .env (which now
// contains KEYCLOAK vars, DATABASE_URL, and other shared settings).
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const serviceName = 'metadata-service';

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
    res.on('finish', () => {
      const actorId =
        req.user?.username ??
        req.user?.sub ??
        req.headers['x-user-id'] ??
        'anonymous';
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
    .setTitle('DocVault Metadata Service')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}
bootstrap();
