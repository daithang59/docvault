import { Module } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
