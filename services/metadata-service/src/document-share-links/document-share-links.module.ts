import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentShareLinksController } from './document-share-links.controller';
import { DocumentShareLinksService } from './document-share-links.service';

@Module({
  imports: [AuditModule],
  controllers: [DocumentShareLinksController],
  providers: [DocumentShareLinksService],
})
export class DocumentShareLinksModule {}
