import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditEventDocument = AuditEvent & Document;

@Schema({ collection: 'audit_events', timestamps: false })
export class AuditEvent {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;

  @Prop({ required: true, index: true })
  actorId: string;

  @Prop({ required: true, type: [String] })
  actorRoles: string[];

  @Prop({ required: true, maxlength: 120, index: true })
  action: string;

  @Prop({ required: true, maxlength: 120 })
  resourceType: string;

  @Prop({ index: true })
  resourceId?: string;

  @Prop({ required: true, maxlength: 40, index: true })
  result: string;

  @Prop()
  reason?: string;

  @Prop()
  ip?: string;

  @Prop()
  traceId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  prevHash?: string;

  @Prop({ required: true })
  hash: string;

  // Compound indexes matching the original Prisma schema
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

// Compound indexes
AuditEventSchema.index({ actorId: 1, timestamp: -1 });
AuditEventSchema.index({ action: 1, timestamp: -1 });
AuditEventSchema.index({ resourceType: 1, resourceId: 1 });
AuditEventSchema.index({ result: 1, timestamp: -1 });
