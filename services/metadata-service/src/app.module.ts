import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLE_TTL, BACKEND_LIMIT } from '@docvault/throttler';
import { InternalAwareThrottlerGuard } from './common/internal-aware-throttler.guard';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentsModule } from './documents/documents.module';
import { AclModule } from './acl/acl.module';
import { VersionsModule } from './versions/versions.module';
import { StatusModule } from './status/status.module';
import { PolicyModule } from './policy/policy.module';
import { AuditModule } from './audit/audit.module';
import { RetentionModule } from './retention/retention.module';
import { DocumentSavedViewsModule } from './document-saved-views/document-saved-views.module';
import { DocumentShareLinksModule } from './document-share-links/document-share-links.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE_TTL * 1000,
        limit: BACKEND_LIMIT,
      },
    ]),
    NestScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    AuditModule,
    AclModule,
    VersionsModule,
    StatusModule,
    PolicyModule,
    DocumentsModule,
    RetentionModule,
    DocumentSavedViewsModule,
    DocumentShareLinksModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAwareThrottlerGuard,
    },
  ],
})
export class AppModule {}
