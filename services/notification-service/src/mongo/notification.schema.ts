import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ collection: 'notifications', timestamps: false })
export class Notification {
  /** Stable public id used by the frontend (kept distinct from Mongo _id). */
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ required: true })
  docId: string;

  /** The user who should see this notification. */
  @Prop({ required: true, index: true })
  recipientId: string;

  @Prop()
  docTitle?: string;

  @Prop()
  reason?: string;

  @Prop()
  traceId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ required: true, index: true })
  createdAt: Date;

  @Prop({ required: true, default: false })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Recipient timeline: list a user's notifications newest-first.
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
// Unread count per recipient.
NotificationSchema.index({ recipientId: 1, read: 1 });
