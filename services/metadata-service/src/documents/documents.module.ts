import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TrashPurgeService } from './trash-purge.service';
import { CommentsModule } from '../comments/comments.module';
import { AclModule } from '../acl/acl.module';
import { AuditModule } from '../audit/audit.module';
import { PolicyModule } from '../policy/policy.module';
import { StatusModule } from '../status/status.module';
import { VersionsModule } from '../versions/versions.module';
import { ApproverDirectoryModule } from '../approvers/approver-directory.module';

@Module({
  imports: [
    AclModule,
    AuditModule,
    PolicyModule,
    StatusModule,
    VersionsModule,
    CommentsModule,
    ApproverDirectoryModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, TrashPurgeService],
})
export class DocumentsModule {}
