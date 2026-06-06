import { Global, Module } from '@nestjs/common';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';

@Global()
@Module({
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}
