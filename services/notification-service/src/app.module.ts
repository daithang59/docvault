import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [AppController],
})
export class AppModule {}
