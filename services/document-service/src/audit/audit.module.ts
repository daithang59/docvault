import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditClient } from './audit.client';

@Module({
  imports: [HttpModule],
  providers: [AuditClient],
  exports: [AuditClient],
})
export class AuditModule {}
