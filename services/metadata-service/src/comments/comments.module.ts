import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuditModule],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
