import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLE_TTL, GATEWAY_LIMIT } from '@docvault/throttler';
import { InternalAwareThrottlerGuard } from './common/internal-aware-throttler.guard';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { UsersModule } from './users/users.module';
import { ProxyService } from './proxy/proxy.service';
import { MetadataProxyController } from './proxy/metadata.proxy.controller';
import { DocumentsProxyController } from './proxy/documents.proxy.controller';
import { WorkflowProxyController } from './proxy/workflow.proxy.controller';
import { AuditProxyController } from './proxy/audit.proxy.controller';
import { NotifyProxyController } from './proxy/notify.proxy.controller';
import { SensitiveActionProofService } from './proxy/sensitive-action-proof.service';
import { GatewayAuditClient } from './audit/audit.client';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    HttpModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE_TTL * 1000,
        limit: GATEWAY_LIMIT,
      },
    ]),
  ],
  controllers: [
    AppController,
    AuthController,
    MetadataProxyController,
    DocumentsProxyController,
    WorkflowProxyController,
    AuditProxyController,
    NotifyProxyController,
  ],
  providers: [
    ProxyService,
    SensitiveActionProofService,
    GatewayAuditClient,
    {
      provide: APP_GUARD,
      useClass: InternalAwareThrottlerGuard,
    },
  ],
})
export class AppModule {}
