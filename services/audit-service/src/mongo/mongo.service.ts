import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEvent, AuditEventDocument } from './audit-event.schema';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);

  constructor(
    @InjectModel(AuditEvent.name)
    readonly auditEvent: Model<AuditEventDocument>,
  ) {}

  async onModuleInit() {
    this.logger.log('Connecting to MongoDB...');
  }

  async onModuleDestroy() {
    await this.auditEvent.db.destroy();
  }
}
