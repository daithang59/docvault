import { Module } from '@nestjs/common';
import { VersionsService } from './versions.service';

@Module({
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
