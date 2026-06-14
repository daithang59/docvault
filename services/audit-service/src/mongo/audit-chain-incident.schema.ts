import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditChainIncidentDocument = AuditChainIncident & Document;

export type AuditChainIncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AuditChainIncidentResolution =
  | 'RESTORED_FROM_TRUSTED_BACKUP'
  | 'NEW_EPOCH_STARTED';

@Schema({ collection: 'audit_chain_incidents', timestamps: false })
export class AuditChainIncident {
  @Prop({ required: true, unique: true, index: true })
  incidentId: string;

  @Prop({ required: true, default: Date.now, index: true })
  detectedAt: Date;

  @Prop({ required: true })
  detectedBy: string;

  @Prop({ required: true, index: true })
  affectedEpochId: string;

  @Prop({ required: true })
  firstBrokenIndex: number;

  @Prop()
  firstBrokenEventId?: string;

  @Prop()
  lastTrustedHash?: string;

  @Prop({ required: true })
  verifyMessage: string;

  @Prop({ required: true, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] })
  status: AuditChainIncidentStatus;

  @Prop({
    required: true,
    enum: ['RESTORED_FROM_TRUSTED_BACKUP', 'NEW_EPOCH_STARTED'],
  })
  resolution: AuditChainIncidentResolution;

  @Prop({ required: true })
  reason: string;
}

export const AuditChainIncidentSchema =
  SchemaFactory.createForClass(AuditChainIncident);
