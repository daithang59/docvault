import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
