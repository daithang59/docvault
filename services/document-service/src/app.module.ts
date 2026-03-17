import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { StorageModule } from './storage/storage.module';
import { MetadataModule } from './metadata/metadata.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MetadataModule,
    StorageModule,
    DocumentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
