import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditEventDocument = AuditEvent & Document;

@Schema({ collection: 'audit_events', timestamps: false })
export class AuditEvent {
  @Prop({ required: true, default: 'default', index: true })
  epochId: string;

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

  // HMAC-SHA256 signature over the event hash, keyed by a server-side secret.
  // Defends against an attacker who can write the DB recomputing the whole
  // chain: without the secret they cannot forge a valid signature.
  // Optional so pre-signing events remain valid (verified as "unsigned").
  @Prop()
  signature?: string;

  // Key id of the secret used to sign, for zero-downtime secret rotation.
  @Prop()
  signatureKid?: string;

  // Compound indexes matching the original Prisma schema
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

// Compound indexes
AuditEventSchema.index({ actorId: 1, timestamp: -1 });
AuditEventSchema.index({ action: 1, timestamp: -1 });
AuditEventSchema.index({ resourceType: 1, resourceId: 1 });
AuditEventSchema.index({ result: 1, timestamp: -1 });

// Enforce a single, fork-free hash chain at the database level: every hash can
// be the predecessor of at most one event, and only one genesis event may have
// prevHash=null. Concurrent inserts racing on the same head trigger a duplicate
// key error, which AuditService.create() catches and retries against the new head.
AuditEventSchema.index({ epochId: 1, prevHash: 1 }, { unique: true });
