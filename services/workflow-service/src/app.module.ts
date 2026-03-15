import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { WorkflowModule } from './workflow/workflow.module';
import { MetadataModule } from './metadata/metadata.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MetadataModule,
    NotificationModule,
    WorkflowModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
