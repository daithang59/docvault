import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLE_TTL, BACKEND_LIMIT } from '@docvault/throttler';
import { InternalAwareThrottlerGuard } from './common/internal-aware-throttler.guard';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { StorageModule } from './storage/storage.module';
import { MetadataModule } from './metadata/metadata.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE_TTL * 1000,
        limit: BACKEND_LIMIT,
      },
    ]),
    AuthModule,
    AuditModule,
    MetadataModule,
    StorageModule,
    DocumentsModule,
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
