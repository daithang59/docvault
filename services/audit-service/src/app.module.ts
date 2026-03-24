import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { MongoModule } from './mongo/mongo.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    // MongoDB connection — reads MONGODB_URI from env
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    AuthModule,
    MongoModule,
    AuditModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
