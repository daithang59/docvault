import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotifyDto, NotifyType } from './dto/notify.dto';
import {
  Notification,
  NotificationDocument,
} from '../mongo/notification.schema';
import { EmailService } from './email.service';
import { UserEmailResolver } from './user-email.resolver';

export interface NotificationRecord {
  id: string;
  type: NotifyType;
  docId: string;
  recipientId: string; // who should see this notification
  docTitle?: string;
  reason?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

export interface NotificationPage {
  records: NotificationRecord[];
  total: number;
  page: number;
  pages: number;
}

const MAX_PER_RECIPIENT = 100;

/**
 * NotifyTypes that also trigger an email (in addition to in-app storage).
 * Configurable via EMAIL_NOTIFY_TYPES (comma-separated); defaults to REJECTED
 * — the workflow event a recipient most needs to act on.
 */
function emailTriggerTypes(): Set<string> {
  const configured = process.env.EMAIL_NOTIFY_TYPES?.trim();
  if (configured) {
    return new Set(
      configured
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    );
  }
  return new Set<string>([NotifyType.REJECTED]);
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly emailTriggers = emailTriggerTypes();

  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
    private readonly email: EmailService,
    private readonly emailResolver: UserEmailResolver,
  ) {}

  private uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private toRecord(doc: any): NotificationRecord {
    return {
      id: doc.id,
      type: doc.type,
      docId: doc.docId,
      recipientId: doc.recipientId,
      docTitle: doc.docTitle,
      reason: doc.reason,
      traceId: doc.traceId,
      metadata: doc.metadata,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date(doc.createdAt).toISOString(),
      read: doc.read ?? false,
    };
  }

  /**
   * Creates one persisted record per unique recipient.
   * Either recipientId or recipientIds (or both) may be supplied.
   */
  async notify(dto: NotifyDto): Promise<{
    accepted: boolean;
    type: string;
    docId: string;
    recipients: string[];
  }> {
    const recipients = [
      ...(dto.recipientIds ?? []),
      ...(dto.recipientId ? [dto.recipientId] : []),
    ];
    const unique = [...new Set(recipients)];

    const base = {
      type: dto.type,
      docId: dto.docId,
      docTitle: dto.docTitle,
      reason: dto.reason,
      traceId: dto.traceId,
      ...(dto.metadata && {
        metadata: sanitizeNotificationMetadata(dto.metadata),
      }),
    };

    for (const recipientId of unique) {
      await this.model.create({
        ...base,
        recipientId,
        id: this.uid(),
        createdAt: new Date(),
        read: false,
      });

      // Bound storage: keep only the newest MAX_PER_RECIPIENT per recipient.
      await this.pruneRecipient(recipientId);
    }

    // Fire-and-forget email for trigger types (in addition to in-app storage).
    // Never blocks or fails the notify call.
    if (this.emailTriggers.has(String(dto.type).toUpperCase())) {
      void this.sendEmails(unique, base);
    }

    this.logger.log(
      JSON.stringify({
        stored: true,
        type: dto.type,
        docId: dto.docId,
        recipients: unique,
      }),
    );

    return {
      accepted: true,
      type: dto.type,
      docId: dto.docId,
      recipients: unique,
    };
  }

  /**
   * Resolve each recipient's email via Keycloak and send. Best-effort: any
   * failure (no email transport, unresolved address, provider error) is
   * logged and skipped — it never affects the stored in-app notification.
   */
  private async sendEmails(
    recipientIds: string[],
    base: { type: string; docId: string; docTitle?: string; reason?: string },
  ): Promise<void> {
    if (!this.email.isEnabled()) return;

    const subject = `[DocVault] ${base.type}: ${base.docTitle ?? base.docId}`;
    const text =
      `A document notification requires your attention.\n\n` +
      `Type: ${base.type}\n` +
      `Document: ${base.docTitle ?? base.docId}\n` +
      (base.reason ? `Reason: ${base.reason}\n` : '') +
      `\nOpen DocVault to view details.`;

    await Promise.allSettled(
      recipientIds.map(async (sub) => {
        const email = await this.emailResolver.resolveEmail(sub);
        if (!email) return;
        await this.email.send({ to: email, subject, text });
      }),
    );
  }

  /** Delete the oldest records beyond the per-recipient cap. */
  private async pruneRecipient(recipientId: string): Promise<void> {
    const total = await this.model.countDocuments({ recipientId });
    if (total <= MAX_PER_RECIPIENT) return;

    const stale = await this.model
      .find({ recipientId }, { id: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .skip(MAX_PER_RECIPIENT)
      .lean();
    const staleIds = (stale as any[]).map((d) => d.id);
    if (staleIds.length > 0) {
      await this.model.deleteMany({ recipientId, id: { $in: staleIds } });
    }
  }

  /**
   * Returns a paginated slice of the user's notifications, newest-first.
   * page is 1-based; limit is clamped to 1..100.
   */
  async getForUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<NotificationPage> {
    const safeL = Math.min(Math.max(1, limit), 100);
    const safeP = Math.max(1, page);
    const skip = (safeP - 1) * safeL;

    const [docs, total] = await Promise.all([
      this.model
        .find({ recipientId: userId })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(safeL)
        .lean(),
      this.model.countDocuments({ recipientId: userId }),
    ]);

    return {
      records: (docs as any[]).map((d) => this.toRecord(d)),
      total,
      page: safeP,
      pages: Math.ceil(total / safeL),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({ recipientId: userId, read: false });
  }

  /**
   * Mark one notification as read by its public id.
   * Returns true if found and updated, false if not found.
   */
  async markAsRead(id: string): Promise<boolean> {
    const result = await this.model.updateOne({ id }, { $set: { read: true } });
    return (result.modifiedCount ?? 0) > 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.model.updateMany(
      { recipientId: userId, read: false },
      { $set: { read: true } },
    );
  }
}

const NOTIFICATION_SENSITIVE_FIELD_NAMES = [
  'fileContent',
  'objectKey',
  'storagePath',
  'presignedUrl',
  'grantToken',
  'downloadToken',
] as const;

function sanitizeNotificationMetadata(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeNotificationValue(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitizeNotificationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeNotificationValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, nestedValue]) => {
    if (isSensitiveNotificationField(key)) {
      return acc;
    }

    acc[key] = sanitizeNotificationValue(nestedValue);
    return acc;
  }, {});
}

function isSensitiveNotificationField(key: string): boolean {
  return (NOTIFICATION_SENSITIVE_FIELD_NAMES as readonly string[]).includes(
    key,
  );
}
