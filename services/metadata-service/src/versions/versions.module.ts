import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { ApproverDirectoryModule } from '../approvers/approver-directory.module';
import { VersionsService } from './versions.service';

@Module({
  imports: [NotificationModule, ApproverDirectoryModule],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
