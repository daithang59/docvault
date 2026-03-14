import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { MetadataProxyController } from './metadata.proxy.controller';

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [AppController, MetadataProxyController],
})
export class AppModule {}

