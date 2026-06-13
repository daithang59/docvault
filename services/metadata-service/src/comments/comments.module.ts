import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuditModule, NotificationModule],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
