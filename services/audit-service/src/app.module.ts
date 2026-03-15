import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule],
  controllers: [AppController],
})
export class AppModule {}
