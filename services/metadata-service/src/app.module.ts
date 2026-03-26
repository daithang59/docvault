import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentsModule } from './documents/documents.module';
import { AclModule } from './acl/acl.module';
import { VersionsModule } from './versions/versions.module';
import { StatusModule } from './status/status.module';
import { PolicyModule } from './policy/policy.module';
import { AuditModule } from './audit/audit.module';
import { RetentionModule } from './retention/retention.module';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    AuditModule,
    AclModule,
    VersionsModule,
    StatusModule,
    PolicyModule,
    DocumentsModule,
    RetentionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
