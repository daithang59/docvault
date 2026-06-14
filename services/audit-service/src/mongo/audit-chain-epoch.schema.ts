import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditChainEpochDocument = AuditChainEpoch & Document;

export type AuditChainEpochStatus = 'ACTIVE' | 'SEALED' | 'COMPROMISED';

export type AuditChainEpochGenesisReason =
  | 'INITIAL'
  | 'ROTATION'
  | 'COMPROMISE_RECOVERY';

@Schema({ collection: 'audit_chain_epochs', timestamps: false })
export class AuditChainEpoch {
  @Prop({ required: true, unique: true, index: true })
  epochId: string;

  @Prop({
    required: true,
    enum: ['ACTIVE', 'SEALED', 'COMPROMISED'],
    index: true,
  })
  status: AuditChainEpochStatus;

  @Prop({ required: true, default: Date.now, index: true })
  startedAt: Date;

  @Prop()
  endedAt?: Date;

  @Prop({
    required: true,
    enum: ['INITIAL', 'ROTATION', 'COMPROMISE_RECOVERY'],
  })
  genesisReason: AuditChainEpochGenesisReason;

  @Prop()
  previousEpochId?: string;

  @Prop()
  lastTrustedHash?: string;

  @Prop()
  firstBrokenIndex?: number;

  @Prop()
  firstBrokenEventId?: string;

  @Prop()
  incidentId?: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true })
  reason: string;
}

export const AuditChainEpochSchema =
  SchemaFactory.createForClass(AuditChainEpoch);
