import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetadataClient } from './metadata.client';

@Module({
  imports: [HttpModule],
  providers: [MetadataClient],
  exports: [MetadataClient],
})
export class MetadataModule {}
