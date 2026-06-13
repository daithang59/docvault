import { Module } from '@nestjs/common';
import { ApproverDirectoryService } from './approver-directory.service';

@Module({
  providers: [ApproverDirectoryService],
  exports: [ApproverDirectoryService],
})
export class ApproverDirectoryModule {}
