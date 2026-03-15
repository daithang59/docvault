import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageModule } from '../storage/storage.module';
import { MetadataModule } from '../metadata/metadata.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule, MetadataModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
