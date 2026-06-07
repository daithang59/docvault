import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { UserEmailResolver } from './user-email.resolver';
import { MongoModule } from '../mongo/mongo.module';

@Module({
  imports: [MongoModule],
  controllers: [NotificationController],
  providers: [NotificationService, EmailService, UserEmailResolver],
})
export class NotificationModule {}
