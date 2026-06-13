import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AuditChainEpoch,
  AuditChainEpochSchema,
} from './audit-chain-epoch.schema';
import {
  AuditChainIncident,
  AuditChainIncidentSchema,
} from './audit-chain-incident.schema';
import { AuditEvent, AuditEventSchema } from './audit-event.schema';
import { MongoService } from './mongo.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEvent.name, schema: AuditEventSchema },
      { name: AuditChainEpoch.name, schema: AuditChainEpochSchema },
      { name: AuditChainIncident.name, schema: AuditChainIncidentSchema },
    ]),
  ],
  providers: [MongoService],
  exports: [MongoService, MongooseModule],
})
export class MongoModule {}
