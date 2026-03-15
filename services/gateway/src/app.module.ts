import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ProxyService } from './proxy/proxy.service';
import { MetadataProxyController } from './proxy/metadata.proxy.controller';
import { DocumentsProxyController } from './proxy/documents.proxy.controller';
import { WorkflowProxyController } from './proxy/workflow.proxy.controller';
import { AuditProxyController } from './proxy/audit.proxy.controller';
import { NotifyProxyController } from './proxy/notify.proxy.controller';

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [
    AppController,
    MetadataProxyController,
    DocumentsProxyController,
    WorkflowProxyController,
    AuditProxyController,
    NotifyProxyController,
  ],
  providers: [ProxyService],
})
export class AppModule {}
