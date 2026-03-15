import { Module } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
