import { Module } from '@nestjs/common';
import { AclService } from './acl.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [AclService],
  exports: [AclService],
})
export class AclModule {}
