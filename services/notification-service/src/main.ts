// dotenv MUST be loaded before any NestJS modules are imported, because
// JwtStrategy is constructed during AuthModule initialization — which happens
// before bootstrap() runs.
import * as dotenv from 'dotenv';
dotenv.config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const serviceName = 'notification-service';

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
    .setTitle('DocVault Notification Service')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);
}

bootstrap();
