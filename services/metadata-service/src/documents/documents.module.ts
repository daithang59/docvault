import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AclModule } from '../acl/acl.module';
import { AuditModule } from '../audit/audit.module';
import { PolicyModule } from '../policy/policy.module';
import { StatusModule } from '../status/status.module';
import { VersionsModule } from '../versions/versions.module';

@Module({
  imports: [AclModule, AuditModule, PolicyModule, StatusModule, VersionsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
